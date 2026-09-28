package com.annan.cartoonhub

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URLEncoder

/**
 * The app's "headless browser": a real WebView the user never sees.
 *
 * For a search it opens https://www.dailymotion.com/search/<query>/videos.
 * hook.js is injected before the page's own scripts run; it wraps window.fetch
 * (our DevTools "Network tab") and grabs the page's SEARCH_QUERY request and
 * response. hook.js then replays that request for more pages, sorts the videos
 * by date and posts the finished JSON back here through CHBridge.
 */
@SuppressLint("SetJavaScriptEnabled")
class HeadlessBrowser(activity: Activity) {
    private val main = Handler(Looper.getMainLooper())
    private val web = WebView(activity)
    private var hook = ""
    private var hookInstalled = false

    private var templateAt = 0L        // when the open page last captured SEARCH_QUERY
    private var loadedFamily: Boolean? = null
    private var jobSeq = 0

    private class Job(val query: String, val pages: Int, val family: Boolean, val done: (String?, String?) -> Unit) {
        var id = 0
        var start = 0L
        var waitingForPage = false
    }

    private val queue = ArrayDeque<Job>()
    private var current: Job? = null
    private var timeout: Runnable? = null

    init {
        WebView.setWebContentsDebuggingEnabled(true) // lets you watch it from chrome://inspect
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = true // never autoplay the page's player or ads
            userAgentString = DESKTOP_UA
        }
        web.alpha = 0f
        web.addJavascriptInterface(Bridge(), "CHBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                if (req.isForMainFrame) return null
                val url = req.url.toString()
                val accept = req.requestHeaders["Accept"] ?: ""
                return if (BLOCKED.containsMatchIn(url) || MEDIA.containsMatchIn(url) || accept.startsWith("image/")) {
                    WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
                } else null
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                // Fallback for old WebView versions without document-start scripts.
                if (!hookInstalled) view.evaluateJavascript(hook, null)
            }
        }
        // Sits behind the Flutter UI so Chromium treats it as a visible page.
        activity.findViewById<ViewGroup>(android.R.id.content)
            .addView(web, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    fun setHook(script: String) {
        hook = script
        if (!hookInstalled && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, setOf("https://www.dailymotion.com"))
            hookInstalled = true
        }
    }

    fun search(query: String, pages: Int, family: Boolean, done: (String?, String?) -> Unit) {
        main.post {
            queue.addLast(Job(query, pages, family, done))
            if (current == null) next()
        }
    }

    private fun next() {
        val job = queue.removeFirstOrNull() ?: return
        current = job
        job.id = ++jobSeq
        job.start = System.currentTimeMillis()
        timeout = Runnable { finish(job, null, "Timed out waiting for dailymotion.com") }.also { main.postDelayed(it, 45_000) }

        val pageIsWarm = templateAt > 0 && loadedFamily == job.family &&
            System.currentTimeMillis() - templateAt < REUSE_MS
        if (pageIsWarm) {
            // The search page is already open with a fresh token: reuse its captured request.
            collect(job, fresh = false)
        } else {
            templateAt = 0
            loadedFamily = job.family
            CookieManager.getInstance().setCookie(
                "https://www.dailymotion.com",
                "ff=${if (job.family) "on" else "off"}; domain=.dailymotion.com; path=/",
            )
            job.waitingForPage = true
            web.loadUrl(searchUrl(job.query))
        }
    }

    private fun collect(job: Job, fresh: Boolean) {
        job.waitingForPage = false
        val args = listOf(job.id, JSONObject.quote(job.query), job.pages, job.start, fresh, JSONObject.quote(searchUrl(job.query)))
        web.evaluateJavascript("window.__chCollect && window.__chCollect(${args.joinToString(",")})", null)
    }

    private fun finish(job: Job, json: String?, error: String?) {
        if (current !== job) return
        timeout?.let { main.removeCallbacks(it) }
        current = null
        if (error != null) templateAt = 0 // force a fresh page load next time
        job.done(json, error)
        next()
    }

    private inner class Bridge {
        @JavascriptInterface
        fun post(kind: String, payload: String) {
            main.post {
                val job = current ?: return@post
                when (kind) {
                    // The page's own SEARCH_QUERY request was captured.
                    "captured" -> {
                        templateAt = System.currentTimeMillis()
                        if (job.waitingForPage) collect(job, fresh = true)
                    }
                    "done" -> {
                        val o = JSONObject(payload)
                        if (o.optInt("id") != job.id) return@post
                        if (o.has("error")) finish(job, null, o.getString("error"))
                        else finish(job, o.getJSONObject("result").toString(), null)
                    }
                }
            }
        }
    }

    fun destroy() {
        main.removeCallbacksAndMessages(null)
        web.destroy()
    }

    companion object {
        const val DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
        const val REUSE_MS = 20 * 60 * 1000L
        // Don't block geo.dailymotion.com/player: the search page waits for it before searching.
        val BLOCKED = Regex("doubleclick|googlesyndication|googletagmanager|imasdk|dm-event\\.net|amazon-adsystem|criteo|vendorlist|google-analytics")
        val MEDIA = Regex("\\.(mp4|m3u8|m4s|ts|webm|woff2?|ttf|png|jpe?g|gif|webp|svg)(\\?|$)")

        fun searchUrl(q: String) =
            "https://www.dailymotion.com/search/" + URLEncoder.encode(q, "UTF-8").replace("+", "%20") + "/videos"
    }
}

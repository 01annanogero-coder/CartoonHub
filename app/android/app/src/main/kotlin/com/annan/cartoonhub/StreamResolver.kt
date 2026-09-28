package com.annan.cartoonhub

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import org.json.JSONObject

/**
 * Gets a video's HLS master playlist for the in-app player.
 *
 * Dailymotion's CDN (Cloudflare) answers that one request with a 403 ("E005")
 * unless it comes from a real browser; Dart's HttpClient is refused. So a second
 * hidden WebView sits on www.dailymotion.com and fetches the player metadata +
 * master playlist from there, with the browser's own cookies and network stack.
 * It is separate from HeadlessBrowser so playing a video never disturbs a warm
 * search page. local_server.dart proxies everything after the master playlist.
 */
@SuppressLint("SetJavaScriptEnabled")
class StreamResolver(activity: Activity) {
    private val main = Handler(Looper.getMainLooper())
    private val web = WebView(activity)
    private var state = IDLE
    private val waiting = mutableListOf<Pair<Int, String>>()
    private val pending = HashMap<Int, (String?, String?) -> Unit>()
    private var seq = 0

    init {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            userAgentString = HeadlessBrowser.DESKTOP_UA
        }
        web.alpha = 0f
        web.addJavascriptInterface(Bridge(), "CHStream")
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (state != LOADING) return
                state = READY
                waiting.forEach { (id, xid) -> fetch(id, xid) }
                waiting.clear()
            }

            override fun onReceivedError(view: WebView, req: WebResourceRequest, error: WebResourceError) {
                if (!req.isForMainFrame || state != LOADING) return
                state = IDLE // try loading the page again on the next request
                waiting.forEach { (id, _) -> reply(id, null, "Could not open dailymotion.com: ${error.description}") }
                waiting.clear()
            }
        }
        activity.findViewById<ViewGroup>(android.R.id.content)
            .addView(web, 0, FrameLayout.LayoutParams(1, 1))
    }

    fun resolve(xid: String, done: (String?, String?) -> Unit) {
        main.post {
            val id = ++seq
            pending[id] = done
            main.postDelayed({ reply(id, null, "Timed out asking dailymotion.com for the stream") }, 25_000)
            when (state) {
                READY -> fetch(id, xid)
                LOADING -> waiting.add(id to xid)
                else -> {
                    waiting.add(id to xid)
                    state = LOADING
                    web.loadUrl(ORIGIN_PAGE)
                }
            }
        }
    }

    private fun fetch(id: Int, xid: String) {
        val js = """
            (async function () {
              try {
                var meta = await (await fetch('/player/metadata/video/' + encodeURIComponent(${JSONObject.quote(xid)}), { credentials: 'include' })).json();
                var auto = meta.qualities && meta.qualities.auto;
                var src = auto && auto[0] && auto[0].url;
                if (!src) {
                  var e = meta.error || {};
                  return CHStream.post($id, JSON.stringify({ error: e.title || e.message || 'No HLS stream in player metadata' }));
                }
                var r = await fetch(src, { credentials: 'include' });
                if (!r.ok) return CHStream.post($id, JSON.stringify({ error: 'Dailymotion refused the stream (HTTP ' + r.status + ')' }));
                CHStream.post($id, JSON.stringify({ url: r.url, text: await r.text() }));
              } catch (e) {
                CHStream.post($id, JSON.stringify({ error: String((e && e.message) || e) }));
              }
            })();
        """.trimIndent()
        web.evaluateJavascript(js, null)
    }

    private fun reply(id: Int, json: String?, error: String?) {
        pending.remove(id)?.invoke(json, error)
    }

    private inner class Bridge {
        @JavascriptInterface
        fun post(id: Int, json: String) {
            main.post { reply(id, json, null) }
        }
    }

    fun destroy() {
        main.removeCallbacksAndMessages(null)
        web.destroy()
    }

    companion object {
        private const val IDLE = 0
        private const val LOADING = 1
        private const val READY = 2
        // Tiny page, only needed so fetches run with the www.dailymotion.com origin and cookies.
        const val ORIGIN_PAGE = "https://www.dailymotion.com/robots.txt"
    }
}

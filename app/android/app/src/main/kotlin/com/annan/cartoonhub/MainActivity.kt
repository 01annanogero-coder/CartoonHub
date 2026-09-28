package com.annan.cartoonhub

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var headless: HeadlessBrowser? = null
    private var streams: StreamResolver? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "cartoonhub/headless").setMethodCallHandler { call, result ->
            // Created on first use, after the Flutter view is on screen.
            val browser = headless ?: HeadlessBrowser(this).also { headless = it }
            when (call.method) {
                "manifest" -> (streams ?: StreamResolver(this).also { streams = it })
                    .resolve(call.argument<String>("xid") ?: "") { json, error ->
                        if (error != null) result.error("STREAM_FAILED", error, null) else result.success(json)
                    }
                "init" -> {
                    browser.setHook(call.argument<String>("script") ?: "")
                    result.success(true)
                }
                "search" -> browser.search(
                    call.argument<String>("query") ?: "",
                    call.argument<Int>("pages") ?: 2,
                    call.argument<Boolean>("family") ?: false,
                ) { json, error ->
                    if (error != null) result.error("SEARCH_FAILED", error, null) else result.success(json)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) Updater(this).run() // once per launch, not on rotation
    }

    override fun onDestroy() {
        headless?.destroy()
        streams?.destroy()
        super.onDestroy()
    }
}

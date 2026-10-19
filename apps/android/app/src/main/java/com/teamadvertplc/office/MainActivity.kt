package com.teamadvertplc.office

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JsPromptResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * The office (https://teamadvertplc.com/office/) behind the phone's own lock: fingerprint, face, or the phone's
 * PIN / pattern / password, whichever the owner set up. The app locks when opened and again after
 * [RELOCK_AFTER_MS] in the background. Signing in to the office itself still uses the office username and PIN.
 */
class MainActivity : AppCompatActivity() {

    private companion object {
        const val HOST = "teamadvertplc.com"
        const val HOME = "https://$HOST/office/"
        const val RELOCK_AFTER_MS = 60_000L

        // Fingerprint and face (any strength) or, if the person prefers, the phone's PIN / pattern / password
        const val AUTHENTICATORS = BIOMETRIC_WEAK or DEVICE_CREDENTIAL

        // window.print() is not supported in a WebView: the page asks for it through prompt() and we print natively
        const val PRINT_SIGNAL = "__teamadvert_print__"
        const val PRINT_HOOK = "window.print = function () { prompt('$PRINT_SIGNAL'); };"

        // Links that may leave the app to another app (calls, WhatsApp, maps, …)
        val EXTERNAL_SCHEMES = setOf("https", "http", "tel", "mailto", "sms", "geo", "whatsapp", "tg", "market")
    }

    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var popup: View
    private lateinit var popupHolder: FrameLayout
    private lateinit var lock: View
    private lateinit var lockMessage: TextView
    private lateinit var settingsButton: Button

    private var popupWeb: WebView? = null
    private var unlocked = false
    private var prompting = false
    private var backgroundedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        progress = findViewById(R.id.progress)
        popup = findViewById(R.id.popup)
        popupHolder = findViewById(R.id.popupHolder)
        lock = findViewById(R.id.lock)
        lockMessage = findViewById(R.id.lockMessage)
        settingsButton = findViewById(R.id.settings)

        // Keep content clear of the status and navigation bars (and the keyboard)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        // Office data must not show in the recent-apps overview
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(false)

        CookieManager.getInstance().setAcceptCookie(true)
        setUpWebView(web)
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(HOME)

        findViewById<Button>(R.id.unlock).setOnClickListener { authenticate() }
        settingsButton.setOnClickListener { startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) }
        findViewById<Button>(R.id.popupClose).setOnClickListener { closePopup() }
        findViewById<Button>(R.id.popupPrint).setOnClickListener { popupWeb?.let(::print) }

        onBackPressedDispatcher.addCallback(this) {
            when {
                popupWeb != null -> closePopup()
                web.canGoBack() -> web.goBack()
                else -> {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        }
        showLocked(getString(R.string.lock_message))
    }

    override fun onResume() {
        super.onResume()
        if (unlocked && backgroundedAt > 0 && SystemClock.elapsedRealtime() - backgroundedAt > RELOCK_AFTER_MS) {
            showLocked(getString(R.string.lock_message))
        }
        backgroundedAt = 0
        if (!unlocked && !prompting) authenticate()
    }

    override fun onStop() {
        super.onStop()
        if (unlocked) backgroundedAt = SystemClock.elapsedRealtime()
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        closePopup()
        web.destroy()
        super.onDestroy()
    }

    // ---------- Lock ----------

    private fun authenticate() {
        val status = BiometricManager.from(this).canAuthenticate(AUTHENTICATORS)
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            // No PIN, pattern, fingerprint or face set up: the office stays locked until there is one
            showLocked(getString(R.string.lock_no_screen_lock), offerSettings = true)
            return
        }
        prompting = true
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                prompting = false
                showUnlocked()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                prompting = false
                showLocked(getString(R.string.lock_retry))
            }
        })
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.prompt_title))
                .setSubtitle(getString(R.string.prompt_subtitle))
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build(),
        )
    }

    private fun showLocked(message: String, offerSettings: Boolean = false) {
        unlocked = false
        lockMessage.text = message
        settingsButton.visibility = if (offerSettings) View.VISIBLE else View.GONE
        lock.visibility = View.VISIBLE
        // Hidden (not just covered) so accessibility services can't read the office behind the lock screen
        web.visibility = View.INVISIBLE
        if (popupWeb != null) popup.visibility = View.INVISIBLE
    }

    private fun showUnlocked() {
        unlocked = true
        lock.visibility = View.GONE
        web.visibility = View.VISIBLE
        if (popupWeb != null) popup.visibility = View.VISIBLE
    }

    // ---------- Office ----------

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView(view: WebView) {
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString TeamAdvertOffice/${packageManager.getPackageInfo(packageName, 0).versionName}"
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)

        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                if (isOffice(request.url)) return false
                openOutside(request.url)
                // A new window that only led to another app (e.g. WhatsApp) has nothing left to show
                if (v === popupWeb && v.url.isNullOrEmpty()) closePopup()
                return true
            }

            override fun onPageFinished(v: WebView, url: String?) {
                v.evaluateJavascript(PRINT_HOOK, null)
            }

            override fun onReceivedError(v: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && v === web) showOffline()
            }
        }

        view.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(v: WebView, newProgress: Int) {
                if (v !== web) return
                progress.progress = newProgress
                progress.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }

            override fun onCreateWindow(v: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                openPopup(resultMsg)
                return true
            }

            override fun onCloseWindow(window: WebView) {
                if (window === popupWeb) closePopup()
            }

            override fun onJsPrompt(v: WebView, url: String?, message: String?, defaultValue: String?, result: JsPromptResult): Boolean {
                if (message != PRINT_SIGNAL) return false
                result.confirm("")
                print(v)
                return true
            }
        }
    }

    private fun isOffice(uri: Uri) =
        uri.toString() == "about:blank" || (uri.scheme == "https" && (uri.host == HOST || uri.host == "www.$HOST"))

    private fun openOutside(uri: Uri) {
        if (uri.scheme !in EXTERNAL_SCHEMES) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    /** The office opens printouts with window.open(): show that window full screen with Close and Print buttons. */
    private fun openPopup(resultMsg: Message) {
        closePopup()
        val child = WebView(this)
        setUpWebView(child)
        popupHolder.addView(child, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        popupWeb = child
        popup.visibility = if (unlocked) View.VISIBLE else View.INVISIBLE
        (resultMsg.obj as WebView.WebViewTransport).webView = child
        resultMsg.sendToTarget()
        // The opener writes the document straight into this window; hook print as soon as it exists
        child.post { child.evaluateJavascript(PRINT_HOOK, null) }
    }

    private fun closePopup() {
        val child = popupWeb ?: return
        popupWeb = null
        popupHolder.removeView(child)
        child.destroy()
        popup.visibility = View.GONE
    }

    private fun print(view: WebView) {
        val name = "Team Advert - ${view.title?.takeIf { it.isNotBlank() } ?: "document"}"
        val attributes = PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build()
        getSystemService(PrintManager::class.java).print(name, view.createPrintDocumentAdapter(name), attributes)
    }

    private fun showOffline() {
        val page = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>body{font-family:sans-serif;display:flex;min-height:90vh;align-items:center;justify-content:center;text-align:center;color:#0b1a3a;padding:24px}
            button{margin-top:20px;background:#1a73e8;color:#fff;border:0;border-radius:24px;padding:12px 28px;font-size:16px}p{color:#475569}</style></head>
            <body><div><h2>No connection</h2><p>The office needs the internet. Check your connection and try again.</p>
            <button onclick="location.replace('$HOME')">Try again</button></div></body></html>
        """.trimIndent()
        web.loadDataWithBaseURL(HOME, page, "text/html", "utf-8", null)
    }
}

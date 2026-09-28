package com.volleyball.scoreboard.webview

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams

/**
 * Приложение-обёртка: мобильная веб-версия Volleyball Scoreboard в WebView.
 *
 * Возможности:
 *  - стартовый адрес задаётся пользователем (кнопка «Настройки» в правом верхнем
 *    углу) и сохраняется в SharedPreferences;
 *  - если адрес не задан или поле пустое — старт со страницы по умолчанию
 *    (res/values/strings.xml → default_start_url);
 *  - переходы внутри сайта остаются в WebView, чужие домены (http/https)
 *    открываются во внешнем браузере, остальные схемы (tel:, mailto:)
 *    отдаются системе;
 *  - ссылки вкладки «Ссылки» мобильной страницы (div#pageLinks) всегда
 *    открываются во внешнем браузере — через инъецированный скрипт и JS-мост;
 *  - инъецируемый CSS сдвигает db-provider-badge влево, чтобы кнопка
 *    «Настройки» не перекрывала бейдж (в браузере бейдж у правого края);
 *  - кнопка/жест «Назад» показывает диалог подтверждения выхода
 *    (без перехода по истории страниц), подтверждение закрывает приложение.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        /** Хранилище настроек (адрес стартовой страницы). */
        private const val PREFS_NAME = "vb_webview_prefs"
        private const val KEY_START_URL = "start_url"

        /** Добавка к User-Agent, чтобы на сервере можно было отличить приложение. */
        private const val UA_SUFFIX = " VolleyballWebView/1.0.3"

        /** Имя JS-объекта-моста, через который страница открывает ссылки в браузере. */
        private const val JS_BRIDGE_NAME = "VBLinkBridge"

        /**
         * Скрипт, инъецируемый после каждой загрузки страницы: клики по ссылкам
         * вкладки «Ссылки» (div#pageLinks) не выполняются в WebView, а уходят
         * во внешний браузер через JS-мост. Делегирование на document переживает
         * позднее заполнение href'ов скриптами страницы, флаг в window не даёт
         * повесить слушатель дважды.
         */
        private val EXTERNAL_LINKS_SCRIPT = """
            (function () {
              if (window.__vbLinksHooked) return;
              window.__vbLinksHooked = true;
              document.addEventListener('click', function (e) {
                var a = e.target && e.target.closest ? e.target.closest('a') : null;
                if (!a || !a.closest('#pageLinks')) return;
                var href = a.getAttribute('href');
                if (!href || href === '#') return;
                if (typeof VBLinkBridge === 'undefined') return;
                e.preventDefault();
                VBLinkBridge.openExternal(a.href);
              }, true);
            })();
        """.trimIndent()

        /**
         * CSS, инъецируемый в приложении после каждой загрузки страницы:
         * сдвигает db-provider-badge влево, чтобы он не попадал под кнопку
         * «Настройки» (36px влево от правого края шапки — кнопка занимает
         * ~34dp, остаётся ~14px зазора). Без инъекции (обычный браузер)
         * бейдж остаётся у правого края. Повторные вызовы безопасны:
         * элемент <style> создаётся один раз (id-гард).
         */
        private val APP_ONLY_CSS = """
            (function () {
              if (document.getElementById('__vbAppStyle')) return;
              var st = document.createElement('style');
              st.id = '__vbAppStyle';
              st.textContent = '.db-provider-badge { margin-right: 36px !important; }';
              (document.head || document.documentElement).appendChild(st);
            })();
        """.trimIndent()
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: LinearLayout
    private lateinit var errorText: TextView
    private lateinit var settingsButton: ImageButton

    private val prefs by lazy { getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

    /** Адрес по умолчанию из ресурсов (единственный источник значения). */
    private val defaultUrl: String get() = getString(R.string.default_start_url)

    /** Обработчик выбора файла для <input type="file"> внутри страницы. */
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback ?: return@registerForActivityResult
            fileChooserCallback = null
            val data = result.data
            val resultCode = result.resultCode
            val uris = if (resultCode == RESULT_OK && data != null) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            callback.onReceiveValue(uris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorView = findViewById(R.id.errorView)
        errorText = findViewById(R.id.errorText)
        settingsButton = findViewById(R.id.settingsButton)

        keepSettingsButtonBelowStatusBar()
        settingsButton.setOnClickListener { showSettingsDialog() }
        findViewById<Button>(R.id.retryButton).setOnClickListener { loadStartUrl() }

        configureWebView()
        handleBackPress()

        if (savedInstanceState == null) {
            loadStartUrl()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        if (webView.restoreState(savedInstanceState) == null) {
            loadStartUrl()
        }
    }

    // -------------------------------------------------------------------------
    // Стартовый адрес: чтение, запись, нормализация
    // -------------------------------------------------------------------------

    /**
     * Адрес, с которого стартует приложение: сохранённое значение, а если оно
     * не задано/пустое/испорченное — адрес по умолчанию.
     */
    private fun currentStartUrl(): String =
        normalizeUrl(prefs.getString(KEY_START_URL, "").orEmpty()) ?: defaultUrl

    /** Сохраняет адрес; null/пустая строка — сброс на адрес по умолчанию. */
    private fun saveStartUrl(url: String?) {
        prefs.edit().apply {
            if (url.isNullOrBlank()) remove(KEY_START_URL) else putString(KEY_START_URL, url)
        }.apply()
    }

    /**
     * Приводит введённый путь к URL:
     * «zago.my.to/sb/mobile.html» → «https://zago.my.to/sb/mobile.html».
     * Возвращает null, если это не http(s)-адрес с хостом.
     */
    private fun normalizeUrl(raw: String): String? {
        var value = raw.trim()
        if (value.isEmpty()) return null
        if (!value.contains("://")) value = "https://$value"
        val uri = Uri.parse(value)
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return null
        if (uri.host.isNullOrBlank()) return null
        return value
    }

    private fun loadStartUrl() {
        errorView.visibility = View.GONE
        progressBar.visibility = View.VISIBLE
        webView.loadUrl(currentStartUrl())
    }

    // -------------------------------------------------------------------------
    // Кнопка «Настройки» (правый верхний угол)
    // -------------------------------------------------------------------------

    private fun showSettingsDialog() {
        val content = layoutInflater.inflate(R.layout.dialog_settings, null)
        val input = content.findViewById<EditText>(R.id.urlInput)
        val help = content.findViewById<TextView>(R.id.urlHelp)

        // В поле — только то, что ввёл пользователь: пустое поле означает
        // «старт со страницы по умолчанию» (сам адрес виден в подсказке).
        input.setText(prefs.getString(KEY_START_URL, "").orEmpty())
        input.hint = defaultUrl
        input.setSelection(input.text.length)
        help.text = getString(R.string.settings_url_help, defaultUrl)

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.settings_title)
            .setView(content)
            .setPositiveButton(R.string.save, null) // обработчик ниже
            .setNeutralButton(R.string.use_default) { _, _ ->
                saveStartUrl(null)
                Toast.makeText(this, R.string.settings_reset, Toast.LENGTH_SHORT).show()
                loadStartUrl()
            }
            .setNegativeButton(R.string.cancel, null)
            .create()

        dialog.setOnShowListener {
            // Своя обработка «Сохранить»: при ошибке диалог остаётся открытым.
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val typed = input.text.toString().trim()

                if (typed.isEmpty()) {
                    saveStartUrl(null)
                    dialog.dismiss()
                    Toast.makeText(this, R.string.settings_reset, Toast.LENGTH_SHORT).show()
                    loadStartUrl()
                    return@setOnClickListener
                }

                val normalized = normalizeUrl(typed)
                if (normalized == null) {
                    input.error = getString(R.string.invalid_url)
                    return@setOnClickListener
                }

                saveStartUrl(normalized)
                dialog.dismiss()
                Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
                loadStartUrl()
            }
        }
        dialog.show()
    }

    /**
     * Кнопка не должна залезать под статус-бар: отступ = базовый + системные
     * insets (актуально для устройств с вырезом и для edge-to-edge).
     */
    private fun keepSettingsButtonBelowStatusBar() {
        val baseMargin = resources.getDimensionPixelSize(R.dimen.settings_button_margin)
        ViewCompat.setOnApplyWindowInsetsListener(settingsButton) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updateLayoutParams<FrameLayout.LayoutParams> {
                topMargin = baseMargin + bars.top
                marginEnd = baseMargin + bars.right
            }
            insets
        }
    }

    // -------------------------------------------------------------------------
    // WebView
    // -------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true            // приложение целиком на JS
        settings.domStorageEnabled = true            // localStorage: тема, токены входа
        settings.databaseEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.useWideViewPort = false             // у страницы свой <meta viewport>
        settings.loadWithOverviewMode = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = settings.userAgentString + UA_SUFFIX

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Мост для EXTERNAL_LINKS_SCRIPT: приложение откроет ссылку во внешнем
        // браузере (доступен только из JS, вызов — только с @JavascriptInterface).
        webView.addJavascriptInterface(LinkBridge(), JS_BRIDGE_NAME)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                errorView.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                // Клики по ссылкам вкладки «Ссылки» должны уходить в браузер.
                view?.evaluateJavascript(EXTERNAL_LINKS_SCRIPT, null)
                // Сдвигаем бейдж влево, чтобы он не попадал под кнопку «Настройки».
                view?.evaluateJavascript(APP_ONLY_CSS, null)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                // Навигация по главному фрейму; внутрифреймовые загрузки не трогаем.
                if (!request.isForMainFrame) return false
                val url = request.url
                val scheme = url.scheme?.lowercase()

                // Служебные схемы (about:, javascript:, data:, blob:) — внутрь WebView.
                if (scheme == null || scheme == "about" || scheme == "javascript" ||
                    scheme == "data" || scheme == "blob"
                ) return false

                // Остальные схемы (tel:, mailto:, intent:, market: и т.п.) — системе.
                if (scheme != "http" && scheme != "https") {
                    openExternally(url)
                    return true
                }

                // http/https: чужой хост — во внешний браузер,
                // хост сайта — остаёмся в WebView.
                if (!isInternalUrl(url)) {
                    openExternally(url)
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame != true) return // ресурсы игнорируем
                showLoadError(error?.description?.toString().orEmpty())
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress >= 100) progressBar.visibility = View.GONE
            }

            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (e: ActivityNotFoundException) {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    private fun showLoadError(details: String) {
        progressBar.visibility = View.GONE
        errorText.text = if (details.isBlank()) {
            getString(R.string.error_loading_no_reason)
        } else {
            getString(R.string.error_loading, details)
        }
        errorView.visibility = View.VISIBLE
    }

    /**
     * true, если адрес http(s) ведёт на хост текущей страницы WebView
     * (до первой загрузки — на стартовый адрес): такой переход остаётся
     * внутри приложения, чужой хост открывается во внешнем браузере.
     */
    private fun isInternalUrl(url: Uri): Boolean {
        val host = url.host?.lowercase() ?: return false
        val current = webView.url ?: currentStartUrl()
        return host == Uri.parse(current).host?.lowercase()
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, getString(R.string.no_app_for_link, uri.toString()), Toast.LENGTH_SHORT)
                .show()
        }
    }

    /**
     * JS-мост для инъецированного скрипта: открыть ссылку во внешнем браузере.
     * Вызывается только из JS (метод с @JavascriptInterface), запуск на UI-потоке
     * через runOnUiThread; служебные схемы (javascript:, data:, about:, blob:)
     * не пропускаются.
     */
    inner class LinkBridge {
        @JavascriptInterface
        fun openExternal(url: String) {
            val uri = Uri.parse(url)
            val scheme = uri.scheme?.lowercase()
            if (scheme == null || scheme == "javascript" || scheme == "data" ||
                scheme == "about" || scheme == "blob"
            ) return
            runOnUiThread { openExternally(uri) }
        }
    }

    // -------------------------------------------------------------------------
    // Кнопка «Назад»
    // -------------------------------------------------------------------------

    private fun handleBackPress() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                confirmExit()
            }
        })
    }

    /**
     * Диалог «Вы хотите выйти из приложения?»: по «Да» приложение закрывается,
     * по «Нет» — возвращается на текущую страницу (история не откатывается).
     */
    private fun confirmExit() {
        AlertDialog.Builder(this)
            .setMessage(R.string.exit_confirm)
            .setPositiveButton(R.string.exit_yes) { _, _ -> finish() }
            .setNegativeButton(R.string.exit_no, null)
            .show()
    }
}

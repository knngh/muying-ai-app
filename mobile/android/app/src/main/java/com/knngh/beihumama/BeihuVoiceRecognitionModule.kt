package com.knngh.beihumama

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.util.Locale

class BeihuVoiceRecognitionModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), RecognitionListener {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var activePromise: Promise? = null
  private var timeoutRunnable: Runnable? = null

  override fun getName(): String = "BeihuVoiceRecognition"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext))
  }

  @ReactMethod
  fun startRecognition(localeTag: String?, timeoutMs: Double, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (activePromise != null) {
        promise.reject("VOICE_RECOGNITION_BUSY", "语音识别正在进行中")
        return@runOnUiThread
      }

      if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
        promise.reject("VOICE_RECOGNITION_UNAVAILABLE", "当前设备不支持系统语音识别")
        return@runOnUiThread
      }

      activePromise = promise
      recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).also {
        it.setRecognitionListener(this)
      }

      val normalizedLocale = localeTag?.takeIf { it.isNotBlank() } ?: Locale.SIMPLIFIED_CHINESE.toLanguageTag()
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, normalizedLocale)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      }

      recognizer?.startListening(intent)
      val boundedTimeout = timeoutMs.toLong().coerceIn(3000L, 60000L)
      timeoutRunnable = Runnable {
        recognizer?.stopListening()
      }
      mainHandler.postDelayed(timeoutRunnable!!, boundedTimeout)
    }
  }

  @ReactMethod
  fun cancelRecognition(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      cleanup()
      promise.resolve(null)
    }
  }

  override fun invalidate() {
    cleanup()
    super.invalidate()
  }

  override fun onResults(results: Bundle?) {
    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
    val transcript = matches.firstOrNull()?.trim().orEmpty()
    if (transcript.isBlank()) {
      finishError("VOICE_RECOGNITION_NO_MATCH", "没有识别到清晰语音")
      return
    }

    finishSuccess(transcript)
  }

  override fun onError(error: Int) {
    val code = when (error) {
      SpeechRecognizer.ERROR_NETWORK,
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT,
      SpeechRecognizer.ERROR_SERVER -> "VOICE_RECOGNITION_NETWORK"
      SpeechRecognizer.ERROR_AUDIO -> "VOICE_RECOGNITION_AUDIO"
      SpeechRecognizer.ERROR_CLIENT,
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "VOICE_RECOGNITION_BUSY"
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "VOICE_PERMISSION_DENIED"
      SpeechRecognizer.ERROR_NO_MATCH,
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "VOICE_RECOGNITION_NO_MATCH"
      else -> "VOICE_RECOGNITION_FAILED"
    }
    finishError(code, errorMessage(code))
  }

  override fun onReadyForSpeech(params: Bundle?) = Unit
  override fun onBeginningOfSpeech() = Unit
  override fun onRmsChanged(rmsdB: Float) = Unit
  override fun onBufferReceived(buffer: ByteArray?) = Unit
  override fun onEndOfSpeech() = Unit
  override fun onPartialResults(partialResults: Bundle?) = Unit
  override fun onEvent(eventType: Int, params: Bundle?) = Unit

  private fun finishSuccess(transcript: String) {
    val promise = activePromise
    cleanup()
    promise?.resolve(transcript)
  }

  private fun finishError(code: String, message: String) {
    val promise = activePromise
    cleanup()
    promise?.reject(code, message)
  }

  private fun cleanup() {
    timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    timeoutRunnable = null
    recognizer?.cancel()
    recognizer?.destroy()
    recognizer = null
    activePromise = null
  }

  private fun errorMessage(code: String): String {
    return when (code) {
      "VOICE_RECOGNITION_NETWORK" -> "网络不稳定，语音识别失败"
      "VOICE_RECOGNITION_AUDIO" -> "麦克风录音失败，请稍后重试"
      "VOICE_RECOGNITION_BUSY" -> "语音识别正在进行中"
      "VOICE_PERMISSION_DENIED" -> "需要开启麦克风权限后才能语音输入"
      "VOICE_RECOGNITION_NO_MATCH" -> "没有识别到清晰语音"
      else -> "语音识别失败，请稍后重试"
    }
  }
}

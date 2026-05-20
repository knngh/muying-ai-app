#import "BeihuVoiceRecognition.h"

#import <AVFoundation/AVFoundation.h>
#import <React/RCTUtils.h>
#import <Speech/Speech.h>

@interface BeihuVoiceRecognition ()

@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, strong) SFSpeechRecognizer *speechRecognizer;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *recognitionRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *recognitionTask;
@property (nonatomic, copy) RCTPromiseResolveBlock activeResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock activeReject;
@property (nonatomic, strong) NSTimer *timeoutTimer;
@property (nonatomic, copy) NSString *lastTranscript;
@property (nonatomic, assign) BOOL hasAudioTap;

@end

@implementation BeihuVoiceRecognition

RCT_EXPORT_MODULE(BeihuVoiceRecognition)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(@([SFSpeechRecognizer class] != nil));
}

RCT_EXPORT_METHOD(startRecognition:(NSString *)localeIdentifier
                  timeoutMs:(nonnull NSNumber *)timeoutMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.activeResolve != nil) {
      reject(@"VOICE_RECOGNITION_BUSY", @"语音识别正在进行中", nil);
      return;
    }

    self.activeResolve = resolve;
    self.activeReject = reject;
    self.lastTranscript = @"";

    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
          [self finishWithErrorCode:@"VOICE_PERMISSION_DENIED" message:@"需要开启语音识别权限后才能语音输入"];
          return;
        }

        [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
          dispatch_async(dispatch_get_main_queue(), ^{
            if (!granted) {
              [self finishWithErrorCode:@"VOICE_PERMISSION_DENIED" message:@"需要开启麦克风权限后才能语音输入"];
              return;
            }

            [self startAudioRecognitionWithLocale:localeIdentifier timeoutMs:timeoutMs];
          });
        }];
      });
    }];
  });
}

RCT_EXPORT_METHOD(cancelRecognition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self cleanupWithCancel:YES];
    resolve(nil);
  });
}

- (void)startAudioRecognitionWithLocale:(NSString *)localeIdentifier timeoutMs:(NSNumber *)timeoutMs
{
  NSString *normalizedLocale = localeIdentifier.length > 0 ? localeIdentifier : @"zh-CN";
  self.speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:[[NSLocale alloc] initWithLocaleIdentifier:normalizedLocale]];
  if (self.speechRecognizer == nil || !self.speechRecognizer.isAvailable) {
    [self finishWithErrorCode:@"VOICE_RECOGNITION_UNAVAILABLE" message:@"当前设备不支持系统语音识别"];
    return;
  }

  self.audioEngine = [[AVAudioEngine alloc] init];
  self.recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
  self.recognitionRequest.shouldReportPartialResults = YES;

  AVAudioSession *audioSession = [AVAudioSession sharedInstance];
  NSError *sessionError = nil;
  [audioSession setCategory:AVAudioSessionCategoryRecord
                       mode:AVAudioSessionModeMeasurement
                    options:AVAudioSessionCategoryOptionDuckOthers
                      error:&sessionError];
  if (sessionError != nil) {
    [self finishWithErrorCode:@"VOICE_RECOGNITION_AUDIO" message:@"麦克风录音失败，请稍后重试"];
    return;
  }
  [audioSession setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];

  AVAudioInputNode *inputNode = self.audioEngine.inputNode;
  AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];
  [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
    [self.recognitionRequest appendAudioPCMBuffer:buffer];
  }];
  self.hasAudioTap = YES;

  __weak typeof(self) weakSelf = self;
  self.recognitionTask = [self.speechRecognizer recognitionTaskWithRequest:self.recognitionRequest resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (strongSelf == nil || strongSelf.activeResolve == nil) {
        return;
      }

      if (result != nil) {
        NSString *transcript = result.bestTranscription.formattedString ?: @"";
        strongSelf.lastTranscript = transcript;
        if (result.isFinal && transcript.length > 0) {
          [strongSelf finishWithText:transcript];
          return;
        }
      }

      if (error != nil) {
        if (strongSelf.lastTranscript.length > 0) {
          [strongSelf finishWithText:strongSelf.lastTranscript];
        } else {
          [strongSelf finishWithErrorCode:@"VOICE_RECOGNITION_FAILED" message:@"语音识别失败，请稍后重试"];
        }
      }
    });
  }];

  NSError *startError = nil;
  [self.audioEngine prepare];
  [self.audioEngine startAndReturnError:&startError];
  if (startError != nil) {
    [self finishWithErrorCode:@"VOICE_RECOGNITION_AUDIO" message:@"麦克风录音失败，请稍后重试"];
    return;
  }

  NSTimeInterval seconds = MIN(MAX(timeoutMs.doubleValue / 1000.0, 3.0), 60.0);
  self.timeoutTimer = [NSTimer scheduledTimerWithTimeInterval:seconds
                                                       target:self
                                                     selector:@selector(handleRecognitionTimeout)
                                                     userInfo:nil
                                                      repeats:NO];
}

- (void)handleRecognitionTimeout
{
  if (self.lastTranscript.length > 0) {
    [self finishWithText:self.lastTranscript];
  } else {
    [self finishWithErrorCode:@"VOICE_RECOGNITION_NO_MATCH" message:@"没有识别到清晰语音"];
  }
}

- (void)finishWithText:(NSString *)text
{
  RCTPromiseResolveBlock resolve = self.activeResolve;
  [self cleanupWithCancel:NO];
  resolve(text);
}

- (void)finishWithErrorCode:(NSString *)code message:(NSString *)message
{
  RCTPromiseRejectBlock reject = self.activeReject;
  [self cleanupWithCancel:YES];
  reject(code, message, nil);
}

- (void)cleanupWithCancel:(BOOL)cancelTask
{
  [self.timeoutTimer invalidate];
  self.timeoutTimer = nil;

  if (self.audioEngine != nil) {
    if (self.hasAudioTap) {
      [self.audioEngine.inputNode removeTapOnBus:0];
      self.hasAudioTap = NO;
    }
    [self.audioEngine stop];
  }

  [self.recognitionRequest endAudio];
  if (cancelTask) {
    [self.recognitionTask cancel];
  }

  [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];

  self.audioEngine = nil;
  self.recognitionRequest = nil;
  self.recognitionTask = nil;
  self.speechRecognizer = nil;
  self.lastTranscript = @"";
  self.activeResolve = nil;
  self.activeReject = nil;
}

@end

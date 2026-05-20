#import "BeihuDailyQuestionReminder.h"

#import <UserNotifications/UserNotifications.h>

static NSString * const BeihuPendingDailyQuestionKey = @"BeihuPendingDailyQuestion";
static NSString * const BeihuDailyQuestionPayloadKey = @"beihu_daily_question";

@implementation BeihuDailyQuestionReminder

RCT_EXPORT_MODULE(BeihuDailyQuestionReminder)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(scheduleDailyQuestionReminders:(NSArray *)items
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (error != nil) {
      reject(@"DAILY_QUESTION_REMINDER_FAILED", @"每日提醒设置失败", error);
      return;
    }

    if (!granted) {
      reject(@"DAILY_QUESTION_REMINDER_PERMISSION_DENIED", @"需要开启通知权限后才能设置每日提醒", nil);
      return;
    }

    NSMutableArray<NSString *> *requestIds = [NSMutableArray array];
    for (NSDictionary *item in items) {
      NSString *requestId = [item[@"requestId"] isKindOfClass:[NSString class]] ? item[@"requestId"] : nil;
      NSString *title = [item[@"title"] isKindOfClass:[NSString class]] ? item[@"title"] : nil;
      NSString *body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : nil;
      NSString *question = [item[@"question"] isKindOfClass:[NSString class]] ? item[@"question"] : nil;
      NSNumber *timestampMs = [item[@"timestampMs"] isKindOfClass:[NSNumber class]] ? item[@"timestampMs"] : nil;
      if (requestId.length == 0 || title.length == 0 || body.length == 0 || question.length == 0 || timestampMs == nil) {
        continue;
      }

      NSDate *date = [NSDate dateWithTimeIntervalSince1970:(timestampMs.doubleValue / 1000.0)];
      if ([date timeIntervalSinceNow] <= 0) {
        continue;
      }

      UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
      content.title = title;
      content.body = body;
      content.sound = [UNNotificationSound defaultSound];
      content.userInfo = @{ BeihuDailyQuestionPayloadKey: question };

      NSDateComponents *components = [[NSCalendar currentCalendar] components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute) fromDate:date];
      UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components repeats:NO];
      UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:requestId content:content trigger:trigger];
      [requestIds addObject:requestId];
      [center addNotificationRequest:request withCompletionHandler:nil];
    }

    resolve(@(requestIds.count));
  }];
}

RCT_EXPORT_METHOD(consumePendingDailyQuestion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *question = [[NSUserDefaults standardUserDefaults] stringForKey:BeihuPendingDailyQuestionKey];
  if (question.length > 0) {
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:BeihuPendingDailyQuestionKey];
    resolve(question);
    return;
  }

  resolve(nil);
}

@end

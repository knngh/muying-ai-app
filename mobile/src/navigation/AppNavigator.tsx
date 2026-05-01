import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LinearGradient from "react-native-linear-gradient";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { setNavigationReset, updateCachedToken } from "../api/index";
import { config } from "../config";
import { useAppStore } from "../stores/appStore";
import { useChatStore } from "../stores/chatStore";
import { useMembershipStore } from "../stores/membershipStore";
import { sessionStorage } from "../utils/storage";
import { colors } from "../theme";
import LaunchScreen, { type LaunchStep } from "../components/launch/LaunchScreen";
import { getStageSummary } from "../utils/stage";

// Screens
import HomeScreen from "../screens/HomeScreen";
import ChatScreen from "../screens/ChatScreen";
import KnowledgeScreen from "../screens/KnowledgeScreen";
import KnowledgeDetailScreen from "../screens/KnowledgeDetailScreen";
import CalendarScreen from "../screens/CalendarScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import ProfileScreen from "../screens/ProfileScreen";
import LoginScreen from "../screens/LoginScreen";
import MembershipScreen from "../screens/MembershipScreen";
import WeeklyReportScreen from "../screens/WeeklyReportScreen";
import GrowthArchiveScreen from "../screens/GrowthArchiveScreen";
import FamilyProfileScreen from "../screens/FamilyProfileScreen";
import PregnancyProfileScreen from "../screens/PregnancyProfileScreen";

export type AppEntryAction =
  | "checkin"
  | "weekly_report"
  | "calendar"
  | "chat"
  | "membership"
  | "growth_archive";

export type MembershipEntrySource =
  | "home_retention"
  | "home_upgrade"
  | "growth_archive"
  | "weekly_report"
  | "profile"
  | "chat";

export type GrowthArchiveEntrySource =
  | "home_retention"
  | "membership"
  | "profile"
  | "chat";

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  KnowledgeDetail: {
    slug: string;
    source?: "chat_hit";
    aiContext?: {
      qaId?: string;
      trigger?: "hit_card" | "knowledge_action";
      matchReason?: "entry_meta" | "source_url" | "source_title" | "source_keyword";
      originEntrySource?: string;
      originReportId?: string;
    };
  };
  PostDetail: { id: number };
  Calendar:
    | {
        prefillTitle?: string;
        prefillDescription?: string;
        prefillEventType?: "checkup" | "vaccine" | "reminder" | "exercise" | "diet" | "other";
        targetDate?: string;
        source?: "chat" | "weekly_report";
      }
    | undefined;
  Membership:
    | {
        source?: MembershipEntrySource;
        entryAction?: AppEntryAction;
        highlight?: string;
      }
    | undefined;
  WeeklyReport: undefined;
  GrowthArchive:
    | {
        source?: GrowthArchiveEntrySource;
        focus?: "timeline" | "report" | "export";
      }
    | undefined;
  FamilyProfile: undefined;
  PregnancyProfile: undefined;
};

export type TabParamList = {
  Home: undefined;
  Chat:
    | {
        prefillQuestion?: string;
        prefillContext?: Record<string, string | number | boolean | null>;
        autoSend?: boolean;
        source?: "weekly_report" | "home_suggested_question" | "knowledge_detail" | "knowledge_recent_ai";
      }
    | undefined;
  Knowledge: undefined;
  CalendarTab: undefined;
  Profile: { autoOpenEdit?: boolean } | undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

type BootScreenState = {
  chipLabel: string;
  title: string;
  subtitle: string;
  statusTitle: string;
  statusText: string;
  progress: number;
  spotlight: {
    eyebrow: string;
    title: string;
    caption: string;
  };
  journey: string[];
  steps: LaunchStep[];
};

function buildBootSteps(activeIndex: number, doneCount: number): LaunchStep[] {
  const labels = ["识别本机会话", "恢复当前阶段", "同步配额与周报", "进入首页"];

  return labels.map((label, index) => ({
    label,
    status: index < doneCount ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

const DEFAULT_BOOT_SCREEN: BootScreenState = {
  chipLabel: "移动端唤起中",
  title: "正在恢复连续陪伴链路",
  subtitle: "会先恢复当前阶段，再同步阅读问答、周报与成长档案入口。",
  statusTitle: "准备恢复你的移动端上下文",
  statusText: "贝护妈妈不会把你扔回通用首页，而是尽量接上上次看到的阶段与任务。",
  progress: 0.18,
  spotlight: {
    eyebrow: "恢复内容",
    title: "阶段知识、成长日历、周报与成长档案",
    caption: "这四块会围绕当前阶段一起恢复，而不是分散在独立页面里。",
  },
  journey: ["阶段知识", "成长日历", "周报回顾", "成长档案"],
  steps: buildBootSteps(0, 0),
};

const TAB_VISUALS: Record<keyof TabParamList, {
  label: string;
  icon: string;
  activeIcon: string;
  accent: string;
  beam: string;
  glow: string;
  gradient: [string, string];
}> = {
  Home: {
    label: "首页",
    icon: "home-outline",
    activeIcon: "home",
    accent: colors.primaryDark,
    beam: colors.copper,
    glow: "rgba(244, 216, 199, 0.7)",
    gradient: ["rgba(250, 232, 221, 0.98)", "rgba(244, 216, 199, 0.98)"],
  },
  CalendarTab: {
    label: "成长日历",
    icon: "calendar-blank-outline",
    activeIcon: "calendar-heart",
    accent: colors.techDark,
    beam: colors.techDark,
    glow: "rgba(211, 229, 233, 0.72)",
    gradient: ["rgba(224, 240, 243, 0.98)", "rgba(211, 229, 233, 0.98)"],
  },
  Knowledge: {
    label: "知识库",
    icon: "book-open-page-variant-outline",
    activeIcon: "book-open-page-variant",
    accent: colors.gold,
    beam: colors.gold,
    glow: "rgba(255, 241, 215, 0.76)",
    gradient: ["rgba(247, 238, 220, 0.98)", "rgba(255, 246, 234, 0.98)"],
  },
  Chat: {
    label: "阅读问答",
    icon: "message-processing-outline",
    activeIcon: "message-processing",
    accent: colors.techDark,
    beam: "#F4D0B7",
    glow: "rgba(209, 233, 238, 0.82)",
    gradient: ["rgba(32, 68, 79, 0.98)", "rgba(69, 111, 122, 0.96)"],
  },
  Profile: {
    label: "我的",
    icon: "account-circle-outline",
    activeIcon: "account-circle",
    accent: colors.ink,
    beam: colors.ink,
    glow: "rgba(236, 218, 208, 0.78)",
    gradient: ["rgba(255, 245, 236, 0.98)", "rgba(247, 228, 214, 0.98)"],
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkSoft,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 14,
          backgroundColor: "rgba(255, 251, 247, 0.9)",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: colors.shadowStrong,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.18,
          shadowRadius: 30,
          height: 82,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 4,
          borderRadius: 32,
          borderWidth: 1,
          borderColor: "rgba(94, 126, 134, 0.18)",
        },
        tabBarItemStyle: {
          borderRadius: 24,
          marginHorizontal: 0,
          paddingTop: 1,
          paddingHorizontal: 0,
        },
        tabBarLabel: ({ focused, color }) => {
          const visual = TAB_VISUALS[route.name as keyof TabParamList];
          return (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.tabLabel,
                focused && styles.tabLabelActive,
                focused ? { color: visual.accent } : { color },
              ]}
            >
              {visual.label}
            </Text>
          );
        },
        tabBarIcon: ({ color, size, focused }) => {
          const visual = TAB_VISUALS[route.name as keyof TabParamList];
          const iconName = focused ? visual.activeIcon : visual.icon;
          const isChat = route.name === "Chat";
          const iconColor = focused
            ? (isChat ? "#F3FBFC" : visual.accent)
            : color;
          const activeGlowStyle = [
            styles.tabActiveGlow,
            { backgroundColor: visual.glow },
            isChat && styles.tabActiveGlowChat,
          ];
          const activeBeamStyle = [styles.tabActiveBeam, { backgroundColor: visual.beam }];

          if (focused) {
            return (
              <LinearGradient
                colors={visual.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.tabIconShellActive,
                  isChat && styles.tabIconShellChatActive,
                ]}
              >
                <View style={activeGlowStyle} />
                <View
                  style={[
                    styles.tabActiveGrid,
                    isChat && styles.tabActiveGridChat,
                  ]}
                />
                <View style={activeBeamStyle} />
                <View
                  style={[
                    styles.tabActiveBottomLine,
                    isChat && styles.tabActiveBottomLineChat,
                  ]}
                />
                <MaterialCommunityIcons name={iconName} size={size - 1} color={iconColor} />
              </LinearGradient>
            );
          }

          return (
            <View style={styles.tabIconShell}>
              <View style={styles.tabCoreIdle}>
                <MaterialCommunityIcons name={iconName} size={size - 1} color={iconColor} />
              </View>
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: TAB_VISUALS.Home.label }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{ tabBarLabel: TAB_VISUALS.CalendarTab.label }}
      />
      <Tab.Screen
        name="Knowledge"
        component={KnowledgeScreen}
        options={{ tabBarLabel: TAB_VISUALS.Knowledge.label }}
      />
      {config.enablePublicAiFeatures ? (
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{ tabBarLabel: TAB_VISUALS.Chat.label }}
          listeners={{
            tabPress: () => {
              useChatStore.getState().startFreshSession();
            },
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: TAB_VISUALS.Profile.label }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconShell: {
    width: 46,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.38)",
    borderWidth: 1,
    borderColor: "rgba(94,126,134,0.08)",
  },
  tabIconShellActive: {
    width: 46,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(94,126,134,0.18)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  tabIconShellChatActive: {
    borderColor: "rgba(211, 236, 241, 0.24)",
  },
  tabActiveGlow: {
    position: "absolute",
    top: -10,
    right: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.45,
  },
  tabActiveGlowChat: {
    top: -8,
    right: -4,
    width: 38,
    height: 38,
    borderRadius: 19,
    opacity: 0.5,
  },
  tabActiveGrid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    opacity: 0.36,
  },
  tabActiveGridChat: {
    borderColor: "rgba(223, 244, 248, 0.18)",
    opacity: 0.44,
  },
  tabActiveBeam: {
    position: "absolute",
    top: 4,
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.copper,
  },
  tabActiveBottomLine: {
    position: "absolute",
    left: 9,
    right: 9,
    bottom: 5,
    height: 1,
    backgroundColor: "rgba(94, 126, 134, 0.14)",
  },
  tabActiveBottomLineChat: {
    backgroundColor: "rgba(224, 243, 247, 0.22)",
  },
  tabCoreIdle: {
    width: 26,
    height: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  tabLabel: {
    width: "100%",
    textAlign: "center",
    fontSize: 8,
    fontWeight: "700",
    paddingBottom: 1,
    letterSpacing: 0.15,
  },
  tabLabelActive: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});

export default function AppNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [bootScreen, setBootScreen] = useState<BootScreenState>(DEFAULT_BOOT_SCREEN);
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);
  const ensureFreshQuota = useMembershipStore((state) => state.ensureFreshQuota);

  const checkAuth = useCallback(async () => {
    setBootScreen(DEFAULT_BOOT_SCREEN);
    const token = await sessionStorage.getToken();
    setBootScreen((current) => ({
      ...current,
      statusTitle: token ? "已检测到本机会话" : "未检测到登录态",
      statusText: token
        ? "接下来会继续恢复当前阶段、阅读问答额度和周报入口。"
        : "将进入移动端入口页，你可以登录后继续之前的陪伴链路。",
      progress: token ? 0.28 : 0.74,
      steps: buildBootSteps(token ? 1 : 3, 1),
    }));
    await updateCachedToken();
    if (!token) {
      setBootScreen((current) => ({
        ...current,
        chipLabel: "准备进入移动端入口",
        title: "先登录，再把连续陪伴接起来",
        subtitle: "登录后会按照你的阶段恢复知识、日历、周报和成长档案，而不是从空白页重新开始。",
        statusTitle: "已准备好进入入口页",
        statusText: "如果是新用户，会先从账号登录开始；如果是老用户，后续会按当前阶段恢复首页内容。",
        progress: 0.92,
        spotlight: {
          eyebrow: "为什么要登录",
          title: "因为你的项目核心是“连续陪伴”",
          caption: "只有拿到账号阶段信息，首页、日历、周报和档案才能围绕同一条时间线组织。",
        },
        journey: ["备孕", "孕期", "产后恢复", "育儿阶段"],
        steps: buildBootSteps(3, 3),
      }));
      setIsLoggedIn(false);
      return;
    }

    setToken(token);
    setBootScreen((current) => ({
      ...current,
      statusTitle: "正在恢复当前阶段",
      statusText: "会优先恢复你的阶段信息，让首页和知识库先按当前状态重排。",
      progress: 0.46,
      steps: buildBootSteps(1, 1),
    }));

    const userData = await useAppStore.getState().fetchUser();
    const stage = getStageSummary(userData);

    setBootScreen((current) => ({
      ...current,
      title: `正在恢复${stage.lifecycleLabel}的连续陪伴`,
      subtitle: `${stage.title} 对应的知识、日历、周报与档案入口会一起恢复，不再让你回到通用母婴首页。`,
      statusTitle: "当前阶段已识别",
      statusText: `${stage.focusTitle}：${stage.reminder}`,
      progress: 0.68,
      spotlight: {
        eyebrow: "当前阶段",
        title: `${stage.lifecycleLabel} · ${stage.title}`,
        caption: stage.subtitle,
      },
      journey: ["阶段知识", "成长日历", "周报回顾", "成长档案"],
      steps: buildBootSteps(2, 2),
    }));

    await ensureFreshQuota();
    const membershipState = useMembershipStore.getState();
    const quotaSummary = membershipState.status === "active"
      ? "会员状态已恢复，连续问答和完整周报入口可直接使用。"
      : `基础状态已恢复，阅读问答今日还剩 ${membershipState.remainingToday} 次，可继续从首页任务链路进入。`;

    setBootScreen((current) => ({
      ...current,
      chipLabel: membershipState.status === "active" ? "会员陪伴已恢复" : "基础陪伴已恢复",
      statusTitle: "配额与周报入口已同步",
      statusText: quotaSummary,
      progress: 0.94,
      spotlight: {
        eyebrow: membershipState.status === "active" ? "已恢复的能力" : "当前可用能力",
        title: membershipState.status === "active" ? "连续追问 + 完整周报 + 长期档案" : "阶段知识 + 日历安排 + 周报预览",
        caption: membershipState.status === "active"
          ? "现在进入首页后，会更像回到一套连续陪伴工作台。"
          : "即使没开会员，首页也会先接住当前阶段最重要的下一步。",
      },
      steps: buildBootSteps(3, 3),
    }));

    setIsLoggedIn(true);
  }, [ensureFreshQuota, setToken]);

  useEffect(() => {
    void checkAuth();
    // 设置导航重置函数供 API 401 使用
    setNavigationReset(() => {
      setIsLoggedIn(false);
      setToken(null);
      setUser(null);
      useChatStore.getState().resetState();
      useMembershipStore.getState().resetState();
    });
  }, [checkAuth, setToken, setUser]);

  if (isLoggedIn === null) {
    return (
      <LaunchScreen
        variant="boot"
        chipLabel={bootScreen.chipLabel}
        title={bootScreen.title}
        subtitle={bootScreen.subtitle}
        statusTitle={bootScreen.statusTitle}
        statusText={bootScreen.statusText}
        progress={bootScreen.progress}
        spotlight={bootScreen.spotlight}
        journey={bootScreen.journey}
        steps={bootScreen.steps}
      />
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: {
            backgroundColor: colors.surfaceRaised,
          },
          headerTintColor: colors.ink,
          headerTitleStyle: {
            color: colors.ink,
            fontWeight: "700",
          },
          headerShadowVisible: false,
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
                onLoginSuccess={async () => {
                  await updateCachedToken();
                  await ensureFreshQuota();
                  setIsLoggedIn(true);
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
              name="KnowledgeDetail"
              component={KnowledgeDetailScreen}
              options={{ headerShown: true, title: "文章详情" }}
            />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ headerShown: true, title: "帖子详情" }}
            />
            <Stack.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{ headerShown: true, title: "成长日历" }}
            />
            <Stack.Screen
              name="Membership"
              component={MembershipScreen}
              options={{ headerShown: true, title: "贝护会员" }}
            />
            <Stack.Screen
              name="WeeklyReport"
              component={WeeklyReportScreen}
              options={{ headerShown: true, title: "周度报告" }}
            />
            <Stack.Screen
              name="GrowthArchive"
              component={GrowthArchiveScreen}
              options={{ headerShown: true, title: "成长档案" }}
            />
            <Stack.Screen
              name="FamilyProfile"
              component={FamilyProfileScreen}
              options={{ headerShown: true, title: "家庭档案" }}
            />
            <Stack.Screen
              name="PregnancyProfile"
              component={PregnancyProfileScreen}
              options={{ headerShown: true, title: "孕期档案" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

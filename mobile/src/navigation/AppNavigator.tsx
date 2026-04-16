import React, { useEffect, useState } from "react";
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
import { useAppStore } from "../stores/appStore";
import { useChatStore } from "../stores/chatStore";
import { useMembershipStore } from "../stores/membershipStore";
import { sessionStorage } from "../utils/storage";
import { colors } from "../theme";
import LaunchScreen from "../components/launch/LaunchScreen";

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
  KnowledgeDetail: { slug: string };
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
        autoSend?: boolean;
        source?: "weekly_report" | "home_suggested_question";
      }
    | undefined;
  Knowledge: undefined;
  CalendarTab: undefined;
  Profile: { autoOpenEdit?: boolean } | undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
    label: "问题助手",
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
                <View
                  style={[
                    styles.tabActiveGlow,
                    { backgroundColor: visual.glow },
                    isChat && styles.tabActiveGlowChat,
                  ]}
                />
                <View
                  style={[
                    styles.tabActiveGrid,
                    isChat && styles.tabActiveGridChat,
                  ]}
                />
                <View style={[styles.tabActiveBeam, { backgroundColor: visual.beam }]} />
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
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    checkAuth();
    // 设置导航重置函数供 API 401 使用
    setNavigationReset(() => {
      setIsLoggedIn(false);
      setToken(null);
      setUser(null);
      useChatStore.getState().resetState();
      useMembershipStore.getState().resetState();
    });
  }, []);

  const checkAuth = async () => {
    const token = await sessionStorage.getToken();
    await updateCachedToken();
    setIsLoggedIn(!!token);
    if (token) {
      setToken(token);
      useAppStore.getState().fetchUser();
    }
  };

  if (isLoggedIn === null) {
    return <LaunchScreen variant="boot" />;
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

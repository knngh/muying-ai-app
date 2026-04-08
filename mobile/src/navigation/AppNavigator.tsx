import React, { useEffect, useState } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { setNavigationReset, updateCachedToken } from "../api/index";
import { useAppStore } from "../stores/appStore";
import { useChatStore } from "../stores/chatStore";
import { useMembershipStore } from "../stores/membershipStore";
import { sessionStorage } from "../utils/storage";
import { colors } from "../theme";

// Screens
import HomeScreen from "../screens/HomeScreen";
import ChatScreen from "../screens/ChatScreen";
import KnowledgeScreen from "../screens/KnowledgeScreen";
import KnowledgeDetailScreen from "../screens/KnowledgeDetailScreen";
import CalendarScreen from "../screens/CalendarScreen";
import CommunityScreen from "../screens/CommunityScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import ProfileScreen from "../screens/ProfileScreen";
import LoginScreen from "../screens/LoginScreen";
import MembershipScreen from "../screens/MembershipScreen";
import WeeklyReportScreen from "../screens/WeeklyReportScreen";
import GrowthArchiveScreen from "../screens/GrowthArchiveScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  KnowledgeDetail: { slug: string };
  PostDetail: { id: number };
  Calendar: undefined;
  Membership: undefined;
  WeeklyReport: undefined;
  GrowthArchive: undefined;
};

export type TabParamList = {
  Home: undefined;
  Chat: undefined;
  Knowledge: undefined;
  Community: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName = "home";
          if (route.name === "Home") iconName = "home";
          else if (route.name === "Chat") iconName = "message-question-outline";
          else if (route.name === "Knowledge") iconName = "book-open-outline";
          else if (route.name === "Community")
            iconName = "account-group-outline";
          else if (route.name === "Profile") iconName = "account-outline";

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "首页" }}
      />
      <Tab.Screen
        name="Knowledge"
        component={KnowledgeScreen}
        options={{ tabBarLabel: "知识库" }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: "问题助手" }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{ tabBarLabel: "社区" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: "我的" }}
      />
    </Tab.Navigator>
  );
}

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

  if (isLoggedIn === null) return null; // 加载中

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
              options={{ headerShown: true, title: "孕育日历" }}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React, { useEffect, useState } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setNavigationReset, updateCachedToken } from '../api/index'
import { useAppStore } from '../stores/appStore'

// Screens
import HomeScreen from '../screens/HomeScreen'
import ChatScreen from '../screens/ChatScreen'
import KnowledgeScreen from '../screens/KnowledgeScreen'
import KnowledgeDetailScreen from '../screens/KnowledgeDetailScreen'
import CalendarScreen from '../screens/CalendarScreen'
import CommunityScreen from '../screens/CommunityScreen'
import PostDetailScreen from '../screens/PostDetailScreen'
import ProfileScreen from '../screens/ProfileScreen'
import LoginScreen from '../screens/LoginScreen'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  KnowledgeDetail: { slug: string }
  PostDetail: { id: number }
  Calendar: undefined
}

export type TabParamList = {
  Home: undefined
  Chat: undefined
  Knowledge: undefined
  Community: undefined
  Profile: undefined
}

const Stack = createStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<TabParamList>()

const navigationRef = createNavigationContainerRef<RootStackParamList>()

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1890ff',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '首页' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'AI问答' }} />
      <Tab.Screen name="Knowledge" component={KnowledgeScreen} options={{ tabBarLabel: '知识库' }} />
      <Tab.Screen name="Community" component={CommunityScreen} options={{ tabBarLabel: '社区' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '我的' }} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const setToken = useAppStore(s => s.setToken)

  useEffect(() => {
    checkAuth()
    // 设置导航重置函数供 API 401 使用
    setNavigationReset(() => {
      setIsLoggedIn(false)
      setToken(null)
    })
  }, [])

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('token')
    await updateCachedToken()
    setIsLoggedIn(!!token)
    if (token) {
      setToken(token)
      useAppStore.getState().fetchUser()
    }
  }

  if (isLoggedIn === null) return null // 加载中

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
                onLoginSuccess={async () => {
                  await updateCachedToken()
                  setIsLoggedIn(true)
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
              options={{ headerShown: true, title: '文章详情' }}
            />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ headerShown: true, title: '帖子详情' }}
            />
            <Stack.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{ headerShown: true, title: '孕育日历' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Avatar,
  Card,
  Button,
  Modal,
  Portal,
  TextInput,
  Chip,
  Divider,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useAppStore } from '../stores/appStore';
import { authApi } from '../api/modules';

const THEME_PRIMARY = '#1890ff';

const PREGNANCY_STATUSES = ['备孕中', '孕期中', '产后'];
const GENDER_OPTIONS = ['男', '女', '未知'];

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, setUser, setToken } = useAppStore();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formNickname, setFormNickname] = useState('');
  const [formPregnancyStatus, setFormPregnancyStatus] = useState('备孕中');
  const [formDueDate, setFormDueDate] = useState('');
  const [formBabyBirthday, setFormBabyBirthday] = useState('');
  const [formBabyGender, setFormBabyGender] = useState('未知');

  const maskedPhone = useMemo(() => {
    const phone = user?.phone ?? '';
    if (phone.length >= 7) {
      return phone.slice(0, 3) + '****' + phone.slice(7);
    }
    return phone || '未设置';
  }, [user?.phone]);

  const infoRows = useMemo(
    () => [
      { label: '用户名', value: user?.username ?? '未设置' },
      { label: '手机号', value: maskedPhone },
      { label: '邮箱', value: user?.email ?? '未设置' },
      {
        label: '预产期',
        value: user?.dueDate
          ? dayjs(user.dueDate).format('YYYY-MM-DD')
          : '未设置',
      },
      {
        label: '宝宝生日',
        value: user?.babyBirthday
          ? dayjs(user.babyBirthday).format('YYYY-MM-DD')
          : '未设置',
      },
      { label: '宝宝性别', value: user?.babyGender ?? '未设置' },
      {
        label: '注册时间',
        value: user?.createdAt
          ? dayjs(user.createdAt).format('YYYY-MM-DD')
          : '未设置',
      },
    ],
    [user, maskedPhone],
  );

  const openEditModal = useCallback(() => {
    setFormNickname(user?.nickname ?? '');
    setFormPregnancyStatus(user?.pregnancyStatus ?? '备孕中');
    setFormDueDate(
      user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '',
    );
    setFormBabyBirthday(
      user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '',
    );
    setFormBabyGender(user?.babyGender ?? '未知');
    setEditModalVisible(true);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    try {
      const payload: any = {
        nickname: formNickname.trim(),
        pregnancyStatus: formPregnancyStatus,
        babyGender: formBabyGender,
      };
      if (formDueDate) payload.dueDate = formDueDate;
      if (formBabyBirthday) payload.babyBirthday = formBabyBirthday;

      const res = await authApi.updateProfile(payload) as any;
      const updatedUser = res ?? { ...user, ...payload };
      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert('提示', '资料更新成功');
    } catch (err) {
      Alert.alert('错误', '更新失败，请稍后重试');
    }
  }, [
    formNickname,
    formPregnancyStatus,
    formDueDate,
    formBabyBirthday,
    formBabyGender,
    user,
    setUser,
  ]);

  const handleLogout = useCallback(() => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            setUser(null);
            setToken(null);
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              }),
            );
          } catch (err) {
            console.error('Logout failed', err);
          }
        },
      },
    ]);
  }, [setUser, setToken, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <Avatar.Icon size={80} icon="account" style={styles.avatar} />
          <Text style={styles.nickname}>
            {user?.nickname ?? '未设置昵称'}
          </Text>
          {!!user?.pregnancyStatus && (
            <Chip compact style={styles.statusBadge} textStyle={styles.statusBadgeText}>
              {user.pregnancyStatus}
            </Chip>
          )}
        </View>

        <Card style={styles.infoCard}>
          <Card.Content>
            {infoRows.map((row, index) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {index < infoRows.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          icon="pencil"
          onPress={openEditModal}
          style={styles.editButton}
          buttonColor={THEME_PRIMARY}
        >
          编辑资料
        </Button>

        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          style={styles.logoutButton}
          textColor="#ff4d4f"
        >
          退出登录
        </Button>
      </ScrollView>

      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>编辑资料</Text>

            <TextInput
              label="昵称"
              value={formNickname}
              onChangeText={setFormNickname}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={THEME_PRIMARY}
            />

            <Text style={styles.fieldLabel}>孕育状态</Text>
            <View style={styles.optionRow}>
              {PREGNANCY_STATUSES.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setFormPregnancyStatus(status)}
                  style={[
                    styles.optionButton,
                    formPregnancyStatus === status &&
                      styles.optionButtonSelected,
                  ]}
                >
                  <Text
                    style={{
                      color: formPregnancyStatus === status ? '#fff' : '#333',
                      fontSize: 14,
                    }}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label="预产期 (YYYY-MM-DD)"
              value={formDueDate}
              onChangeText={setFormDueDate}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={THEME_PRIMARY}
              placeholder="例如: 2026-08-15"
            />

            <TextInput
              label="宝宝生日 (YYYY-MM-DD)"
              value={formBabyBirthday}
              onChangeText={setFormBabyBirthday}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={THEME_PRIMARY}
              placeholder="例如: 2026-03-01"
            />

            <Text style={styles.fieldLabel}>宝宝性别</Text>
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setFormBabyGender(g)}
                  style={[
                    styles.optionButton,
                    formBabyGender === g && styles.optionButtonSelected,
                  ]}
                >
                  <Text
                    style={{
                      color: formBabyGender === g ? '#fff' : '#333',
                      fontSize: 14,
                    }}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              mode="contained"
              onPress={handleSaveProfile}
              style={styles.saveButton}
              buttonColor={THEME_PRIMARY}
            >
              保存
            </Button>
            <Button
              mode="text"
              onPress={() => setEditModalVisible(false)}
            >
              取消
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  avatar: {
    backgroundColor: THEME_PRIMARY,
  },
  nickname: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  statusBadge: {
    marginTop: 8,
    backgroundColor: '#e6f7ff',
  },
  statusBadgeText: {
    color: THEME_PRIMARY,
    fontSize: 12,
  },
  infoCard: {
    margin: 16,
    backgroundColor: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  editButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderColor: '#ff4d4f',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  optionButtonSelected: {
    backgroundColor: THEME_PRIMARY,
  },
  saveButton: {
    marginBottom: 8,
    marginTop: 8,
  },
});

export default ProfileScreen;

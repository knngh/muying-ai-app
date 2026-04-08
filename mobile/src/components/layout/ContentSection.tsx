import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { spacing } from "../../theme";

interface ContentSectionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  children,
  style,
}) => {
  return <View style={[styles.section, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
});

// ============================================================
// LƯỚI CHỌN DANH MỤC PASTEL DỄ THƯƠNG
// ============================================================

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import type { Category } from '../../types';

interface CategoryGridProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function CategoryGrid({ categories, selectedId, onSelect }: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Đang tải danh mục... 🌸</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {categories.map((cat) => {
        const isSelected = cat.id === selectedId;

        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={({ pressed }) => [
              styles.item,
              { borderColor: cat.color },
              isSelected && [styles.itemSelected, { backgroundColor: cat.color }],
              pressed && styles.itemPressed,
            ]}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <Text
              style={[
                styles.name,
                isSelected && styles.nameSelected,
              ]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.neutral[0],
    borderWidth: 2,
    gap: 4,
    minWidth: 72,
    // Shadow nhẹ
    shadowColor: '#B882FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  itemSelected: {
    // backgroundColor được set inline từ màu category
  },
  itemPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  nameSelected: {
    color: '#FFFFFF',
  },
  empty: {
    padding: Spacing.base,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.neutral[400],
    fontSize: Typography.fontSize.sm,
  },
});

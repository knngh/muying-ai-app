/** 用户性别 */
export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2,
}

/** 孕期状态 */
export enum PregnancyStatus {
  NONE = 0,
  PREPARING = 1,
  PREGNANT = 2,
  POSTPARTUM = 3,
}

/** 用户状态 */
export enum UserStatus {
  DISABLED = 0,
  ACTIVE = 1,
}

/** 文章状态 */
export enum ArticleStatus {
  DRAFT = 0,
  PUBLISHED = 1,
}

/** 日历事件状态 */
export enum EventStatus {
  PENDING = 0,
  COMPLETED = 1,
}

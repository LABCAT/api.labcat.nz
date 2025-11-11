import {
  pages,
  buildingBlocks,
  animations,
  creativeCoding,
  audioProjects
} from '../db/schema'

export type PageRow = typeof pages.$inferSelect
export type BuildingBlockRow = typeof buildingBlocks.$inferSelect
export type AnimationRow = typeof animations.$inferSelect
export type CreativeCodingRow = typeof creativeCoding.$inferSelect
export type AudioProjectRow = typeof audioProjects.$inferSelect

export type BaseResponse = {
  id: number
  slug: string
  status: string
  type: string
  created: string
  modified: string
  date_gmt: string
  modified_gmt: string
  title: { rendered: string }
  featuredImage: string | null
  featured_image: string | null
  featuredImages: string[]
  featured_images: string[]
}

export type ContentResponse = BaseResponse & {
  content?: { rendered: string | null }
  reactComponent?: string | null
  animationLink?: string | null
}


import { defineCollection, z } from 'astro:content';
import { isLogDate, isLogPhoto } from '../../public/admin/log-data.js';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    // 検索結果用の説明文(任意)。なければ excerpt を使う
    description: z.string().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const logs = defineCollection({
  type: 'data',
  schema: z.object({
    date: z.string().refine(isLogDate, '日付はYYYY-MM-DDで指定してください'),
    body: z.string().trim().min(1),
    photo: z.string().refine(isLogPhoto, '写真はuploads内の画像を指定してください').optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, logs };

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { Search, Loader2, AlertCircle, ExternalLink, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  PromptCard,
  PromptDetailModal,
  PromptGalleryImagePreviewModal,
} from '@/components/prompt-gallery/PromptGallerySubcomponents';
import type { PromptGalleryData, PromptGalleryItem, PromptGallerySection } from '@/lib/prompt-gallery-types';
import { PROMPT_DATA_SOURCES, getPromptSourceLabel } from '@/lib/prompt-gallery-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { seededShuffle } from '@/lib/seeded-shuffle';

const PROMPT_GALLERY_STEP = 20;
const PROMPT_GALLERY_WIDE_STEP = 30;

// 分类配置
const DEFAULT_CATEGORIES = ['全部', '海报', '角色', '电商', 'UI', '风格转换', 'gpt-image-2', '其他'];

const ALL_CATEGORY = '全部';

const PromptGallery = memo(function PromptGallery({ wideMode = false }: { wideMode?: boolean }) {
  const pageStep = wideMode ? PROMPT_GALLERY_WIDE_STEP : PROMPT_GALLERY_STEP;
  const [allPrompts, setAllPrompts] = useState<(PromptGalleryItem & { uniqueKey: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const [detailPrompt, setDetailPrompt] = useState<(PromptGalleryItem & { uniqueKey: string }) | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    prompt: PromptGalleryItem & { uniqueKey: string };
    initialIndex: number;
  } | null>(null);
  const [imageCache, setImageCache] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(pageStep);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/nova/blacklist')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.keywords)) {
          setBlacklist(data.keywords.map((k: string) => k.toLowerCase()));
        }
      })
      .catch(() => {
        setBlacklist([]);
      });

    // 多数据源获取
    const fetchAllSources = async () => {
      const results: (PromptGalleryItem & { uniqueKey: string })[] = [];
      const categorySet = new Set<string>(DEFAULT_CATEGORIES.filter(c => c !== ALL_CATEGORY));

      for (const source of PROMPT_DATA_SOURCES) {
        try {
          if (source.type === 'nanobanana') {
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const json = await res.json();
            const data = json as PromptGalleryData;
            data.sections.forEach((section: PromptGallerySection, sectionIdx: number) => {
              section.prompts.forEach((prompt: PromptGalleryItem, promptIdx: number) => {
                const category = inferCategory(prompt.title, prompt.content, prompt.tags);
                categorySet.add(category);
                results.push({
                  ...prompt,
                  source: source.name,
                  sourceUrl: source.sourceUrl,
                  category,
                  uniqueKey: `${source.name}-${section.id}-${prompt.id}-${sectionIdx}-${promptIdx}`
                });
              });
            });
          } else if (source.type === 'gpt-image-2') {
            const cases: Record<string, string> = {};
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const json = await res.json();

            if (source.caseFiles) {
              for (const file of source.caseFiles) {
                const markdownRes = await fetch(`${source.baseUrl}/${file}`);
                if (markdownRes.ok) {
                  const markdown = await markdownRes.text();
                  collectGptImage2Cases(cases, markdown);
                }
              }
            }

            if (Array.isArray(json.records)) {
              json.records.forEach((record: { title?: string; tweet_url?: string; image_dir?: string; category?: string; added_at?: string }, idx: number) => {
                if (!record.title) return;
                const promptText = cases[record.tweet_url || ''];
                if (!promptText) return;
                const imageUrl = `${source.baseUrl}/${record.image_dir}/output.jpg`;
                categorySet.add('gpt-image-2');
                results.push({
                  id: `gpt-image-2-${idx}`,
                  title: record.title,
                  content: promptText,
                  images: [imageUrl],
                  tags: tagsFromCategory(record.category),
                  contributor: '',
                  notes: '',
                  source: source.name,
                  sourceUrl: source.sourceUrl,
                  category: 'gpt-image-2',
                  uniqueKey: `${source.name}-${idx}`
                });
              });
            }
          } else if (source.type === 'markdown-awesome') {
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const markdown = await res.text();
            const prompts = parseAwesomeGptImageMarkdown(markdown, source.baseUrl || '', source.name);
            prompts.forEach((p, idx) => {
              const category = inferCategory(p.title || '', p.content || '', p.tags || []);
              categorySet.add(category);
              results.push({
                ...p,
                id: p.id || `${source.name}-${idx}`,
                title: p.title || '',
                content: p.content || '',
                images: p.images || [],
                tags: p.tags || [],
                contributor: p.contributor || '',
                notes: p.notes || '',
                source: source.name,
                sourceUrl: source.sourceUrl,
                category,
                uniqueKey: `${source.name}-${idx}`
              });
            });
          } else if (source.type === 'markdown-gpt4o') {
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const markdown = await res.text();
            const prompts = parseGpt4oMarkdown(markdown, source.baseUrl || '', source.name);
            prompts.forEach((p, idx) => {
              categorySet.add('gpt4o');
              results.push({
                ...p,
                id: p.id || `${source.name}-${idx}`,
                title: p.title || '',
                content: p.content || '',
                images: p.images || [],
                tags: p.tags || [],
                contributor: p.contributor || '',
                notes: p.notes || '',
                source: source.name,
                sourceUrl: source.sourceUrl,
                category: 'gpt4o',
                uniqueKey: `${source.name}-${idx}`
              });
            });
          } else if (source.type === 'markdown-youmind') {
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const markdown = await res.text();
            const prompts = parseYouMindMarkdown(markdown, source.baseUrl || '', source.name, source.modelTag || '');
            prompts.forEach((p, idx) => {
              const category = inferCategory(p.title || '', p.content || '', p.tags || []);
              categorySet.add(category);
              results.push({
                ...p,
                id: p.id || `${source.name}-${idx}`,
                title: p.title || '',
                content: p.content || '',
                images: p.images || [],
                tags: p.tags || [],
                contributor: p.contributor || '',
                notes: p.notes || '',
                source: source.name,
                sourceUrl: source.sourceUrl,
                category,
                uniqueKey: `${source.name}-${idx}`
              });
            });
          } else if (source.type === 'davidwu-json') {
            const res = await fetch(source.url);
            if (!res.ok) continue;
            const json = await res.json();
            const prompts = parseDavidWuJson(json, source.baseUrl || '', source.name);
            prompts.forEach((p, idx) => {
              const category = inferCategory(p.title || '', p.content || '', p.tags || []);
              categorySet.add(category);
              results.push({
                ...p,
                id: p.id || `${source.name}-${idx}`,
                title: p.title || '',
                content: p.content || '',
                images: p.images || [],
                tags: p.tags || [],
                contributor: p.contributor || '',
                notes: p.notes || '',
                source: source.name,
                sourceUrl: source.sourceUrl,
                category,
                uniqueKey: `${source.name}-${idx}`
              });
            });
          }
        } catch {
          // 单个数据源失败不影响整体
        }
      }

      setCategories([ALL_CATEGORY, ...Array.from(categorySet)]);
      setAllPrompts(results);
      setLoading(false);
    };

    fetchAllSources().catch(err => {
      setError(err.message);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 推断分类
  const inferCategory = (title: string, content: string, tags: string[]): string => {
    const text = `${title} ${content} ${tags.join(' ')}`.toLowerCase();
    if (text.includes('海报') || text.includes('poster')) return '海报';
    if (text.includes('角色') || text.includes('character') || text.includes('oc')) return '角色';
    if (text.includes('电商') || text.includes('商品') || text.includes('product')) return '电商';
    if (text.includes('ui') || text.includes('界面') || text.includes('设计')) return 'UI';
    if (text.includes('风格') || text.includes('转换') || text.includes('style')) return '风格转换';
    if (text.includes('gpt4o')) return 'gpt4o';
    if (text.includes('gpt-image-2')) return 'gpt-image-2';
    return '其他';
  };

  const collectGptImage2Cases = (cases: Record<string, string>, markdown: string) => {
    const re = new RegExp('### Case \\d+: \\[[^\\]]+\\]\\(([^)]+)\\).*?\\*\\*Prompt:\\*\\*\\s*\\r?\\n\\s*```[\\w-]*\\r?\\n([\\s\\S]*?)\\r?\\n```', 'g');
    let match;
    while ((match = re.exec(markdown)) !== null) {
      cases[match[1]] = match[2].trim();
    }
  };

  const tagsFromCategory = (category?: string): string[] => {
    if (!category) return [];
    return category.replace(/\s+Cases$/i, '').split(/\s*(&|and)\s*/).map(t => t.trim()).filter(Boolean);
  };

  const splitBeforeHeading = (markdown: string, prefix: string): string[] => {
    const blocks: string[] = [];
    const lines = markdown.split('\n');
    let current: string[] = [];
    for (const line of lines) {
      if (line.startsWith(prefix) && current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) {
      blocks.push(current.join('\n'));
    }
    return blocks;
  };

  const firstMatch = (value: string, pattern: string | RegExp): string => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const match = value.match(regex);
    return match && match[1] ? match[1] : '';
  };

  const extractMarkdownImages = (baseURL: string, block: string): string[] => {
    const seen = new Set<string>();
    const images: string[] = [];
    const patterns = [/<img[^>]+src="([^"]+)"/g, /!\[[^\]]*\]\(([^)]+)\)/g];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(block)) !== null) {
        const image = absoluteImage(baseURL, match[1]);
        if (image && !seen.has(image)) {
          seen.add(image);
          images.push(image);
        }
      }
    }
    return images;
  };

  const absoluteImage = (baseURL: string, image: string): string => {
    if (!image) return '';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    return `${baseURL}/${image.replace(/^\./, '').replace(/^\//, '')}`;
  };

  const tagsFromHeading = (heading: string): string[] => {
    if (!heading) return [];
    return heading.replace(/[^\p{L}\p{N}/&、与 ]/gu, '').split(/\s*(\/|&|、|与)\s*/).map(t => t.trim().toLowerCase()).filter(Boolean);
  };

  const youMindTags = (title: string, modelTag: string): string[] => {
    const tags = [modelTag];
    const parts = title.split(' - ', 2);
    if (parts.length > 1) {
      tags.push(...tagsFromHeading(parts[0]));
    }
    return tags;
  };

  const parseAwesomeGptImageMarkdown = (markdown: string, baseURL: string, sourceName: string): Partial<PromptGalleryItem>[] => {
    const prompts: Partial<PromptGalleryItem>[] = [];
    const sections = splitBeforeHeading(markdown, '## ');
    for (const section of sections) {
      const sectionTags = tagsFromHeading(firstMatch(section, /^##\s+(.+)$/m));
      const blocks = splitBeforeHeading(section, '### ');
      for (const block of blocks) {
        let title = firstMatch(block, /^###\s+(.+)$/m);
        title = title.replace(/\[([^\]]+)]\([^)]+\)/g, '$1').trim();
        const prompt = firstMatch(block, /\*\*提示词:\*\*\s*\r?\n\s*```[\w-]*\r?\n([\s\S]*?)\r?\n```/);
        if (!title || !prompt) continue;
        const images = extractMarkdownImages(baseURL, block);
        prompts.push({
          id: `${sourceName}-${prompts.length}`,
          title,
          content: prompt.trim(),
          images,
          tags: sectionTags,
          contributor: '',
          notes: '',
        });
      }
    }
    return prompts;
  };

  const parseGpt4oMarkdown = (markdown: string, baseURL: string, sourceName: string): Partial<PromptGalleryItem>[] => {
    const prompts: Partial<PromptGalleryItem>[] = [];
    const blocks = splitBeforeHeading(markdown, '### ');
    for (const block of blocks) {
      const title = firstMatch(block, /^###\s+(.+)$/m).trim();
      const prompt = firstMatch(block, /- \*\*提示词文本：\*\*\s*`([\s\S]*?)`/);
      if (!title || !prompt) continue;
      const images = extractMarkdownImages(baseURL, block);
      prompts.push({
        id: `${sourceName}-${prompts.length}`,
        title,
        content: prompt.trim(),
        images,
        tags: ['gpt4o'],
        contributor: '',
        notes: '',
      });
    }
    return prompts;
  };

  const parseYouMindMarkdown = (markdown: string, baseURL: string, sourceName: string, modelTag: string): Partial<PromptGalleryItem>[] => {
    const prompts: Partial<PromptGalleryItem>[] = [];
    const blocks = splitBeforeHeading(markdown, '### ');
    for (const block of blocks) {
      const title = firstMatch(block, /^###\s+No\.\s*\d+:\s*(.+)$/m).trim();
      const prompt = firstMatch(block, /#### .*?提示词\s*\r?\n\s*```[\w-]*\r?\n([\s\S]*?)\r?\n```/);
      if (!title || !prompt) continue;
      const images = extractMarkdownImages(baseURL, block);
      prompts.push({
        id: `${sourceName}-${prompts.length}`,
        title,
        content: prompt.trim(),
        images,
        tags: youMindTags(title, modelTag),
        contributor: '',
        notes: '',
      });
    }
    return prompts;
  };

  const parseDavidWuJson = (json: unknown, baseURL: string, sourceName: string): Partial<PromptGalleryItem>[] => {
    const prompts: Partial<PromptGalleryItem>[] = [];
    if (!Array.isArray(json)) return prompts;
    for (const item of json as Record<string, string | undefined>[]) {
      const title = item.title_cn?.trim() || item.title_en?.trim();
      if (!title) continue;
      const prompt = item.prompt?.trim();
      if (!prompt) continue;
      const image = absoluteImage(baseURL, item.image || '');
      const tags: string[] = [];
      if (item.category_cn) tags.push(item.category_cn);
      if (item.category) tags.push(item.category);
      if (item.author) tags.push(item.author);
      if (item.source) tags.push(item.source);
      if (item.needs_ref) tags.push('需要参考图');
      prompts.push({
        id: `${sourceName}-${item.id || prompts.length}`,
        title,
        content: prompt,
        images: image ? [image] : [],
        tags: tags.filter(Boolean),
        contributor: item.author || '',
        notes: item.note || '',
      });
    }
    return prompts;
  };

  const handleShowDetail = useCallback((prompt: PromptGalleryItem & { uniqueKey: string }) => {
    setDetailPrompt(prompt);
  }, []);

  const handleShowImages = useCallback((prompt: PromptGalleryItem & { uniqueKey: string }, initialIndex = 0) => {
    setImagePreview({ prompt, initialIndex });
  }, []);

  const handleImageLoad = useCallback((url: string) => {
    setImageCache(prev => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const baseFilteredPrompts = useMemo(() => {
    let prompts = allPrompts;

    if (blacklist.length > 0) {
      prompts = prompts.filter(p => {
        const contentToCheck = [
          p.title.toLowerCase(),
          p.content.toLowerCase(),
          p.contributor?.toLowerCase() || '',
          p.notes?.toLowerCase() || '',
          ...p.tags.map(tag => tag.toLowerCase())
        ].join(' ');

        return !blacklist.some(keyword => contentToCheck.includes(keyword));
      });
    }

    const hasChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);
    prompts = prompts.filter(p => hasChinese(p.title) || hasChinese(p.content));

    // 分类筛选
    if (selectedCategory !== ALL_CATEGORY) {
      prompts = prompts.filter(p => p.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      prompts = prompts.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        (p.contributor && p.contributor.toLowerCase().includes(query))
      );
    }
    return prompts;
  }, [allPrompts, searchQuery, blacklist, selectedCategory]);

  const filteredPrompts = useMemo(() => {
    const seed = `${searchQuery}\0${blacklist.join('\0')}\0${baseFilteredPrompts.map(p => p.uniqueKey).join('\0')}`;
    return seededShuffle(baseFilteredPrompts, seed);
  }, [baseFilteredPrompts, searchQuery, blacklist]);

  useEffect(() => {
    queueMicrotask(() => setDisplayCount(pageStep));
  }, [searchQuery, pageStep]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < filteredPrompts.length) {
          setDisplayCount(prev => Math.min(prev + pageStep, filteredPrompts.length));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [displayCount, filteredPrompts.length, pageStep]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const displayedPrompts = useMemo(() => {
    return filteredPrompts.slice(0, displayCount);
  }, [filteredPrompts, displayCount]);

  const hasMore = displayCount < filteredPrompts.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索提示词、标题或作者..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'secondary'}
                className="cursor-pointer px-3 py-1 transition-colors hover:bg-primary/80"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            找到 {filteredPrompts.length} 个提示词{displayedPrompts.length < filteredPrompts.length && ` · 显示 ${displayedPrompts.length} 个`}
          </span>
          <Popover>
            <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <span>提示词来源</span>
              <ExternalLink className="w-3 h-3" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2">
              <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">提示词来源（{PROMPT_DATA_SOURCES.length}）</p>
              <div className="space-y-0.5">
                {PROMPT_DATA_SOURCES.map((source) => (
                  <a
                    key={source.name}
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="truncate">{getPromptSourceLabel(source.sourceUrl)}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${wideMode ? '2xl:grid-cols-5' : ''}`}>
          {displayedPrompts.map(prompt => (
            <PromptCard
              key={prompt.uniqueKey}
              prompt={prompt}
              onShowDetail={() => handleShowDetail(prompt)}
              onShowImages={initialIndex => handleShowImages(prompt, initialIndex)}
              imageCache={imageCache}
              onImageLoad={handleImageLoad}
            />
          ))}
        </div>

        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {filteredPrompts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            没有找到匹配的提示词
          </div>
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="回到顶部"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {detailPrompt && (
        <PromptDetailModal
          prompt={detailPrompt}
          onClose={() => setDetailPrompt(null)}
        />
      )}

      {imagePreview && (
        <PromptGalleryImagePreviewModal
          images={imagePreview.prompt.images}
          title={imagePreview.prompt.title}
          prompt={imagePreview.prompt}
          initialIndex={imagePreview.initialIndex}
          onClose={() => setImagePreview(null)}
        />
      )}
    </>
  );
});

export { PromptGallery };

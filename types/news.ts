export interface NewsArticle {
  title_cs: string;
  summary_cs: string;
  title_en: string;
  link: string;
  pubDate: string;
  source: string;
  focus: string;
  image?: string;
}

export interface NewsData {
  articles: NewsArticle[];
  trending: NewsArticle[];
}

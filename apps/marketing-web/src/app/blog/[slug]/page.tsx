import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { getArticles, getArticle } from "@/features/blog/articles";
import { categories, articleDate } from "@/features/blog/catalogue";
import { blogMetadata, articleSchema } from "@/features/blog/metadata";
import styles from "@/features/blog/blog.module.css";
import { ArticleConversion } from "@/features/blog/article-conversion";
import { conversionActions } from "@/features/marketing/conversion-actions";

export const dynamicParams = false;
export function generateStaticParams() {
  return getArticles().map((article) => ({ slug: article.slug }));
}
export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = getArticle(params.slug);
  if (!article) notFound();
  return blogMetadata(article);
}
export default async function ArticleRoute(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = getArticle(params.slug);
  if (!article) notFound();
  const Content = article.content;
  const action = conversionActions[article.conversionTarget];
  return (
    <SiteFrame
      primaryAction={{ href: action.href, label: action.navigationLabel }}
    >
      <article className={styles.article}>
        <Link href="/blog/" className={styles.back}>
          ← All articles
        </Link>
        <header className={styles.articleHeader}>
          <p className={styles.eyebrow}>{categories[article.category]}</p>
          <h1>{article.title}</h1>
          <p className={styles.lead}>{article.description}</p>
          <p className={styles.byline}>
            By {article.author} ·{" "}
            <time dateTime={article.publishedAt}>
              {articleDate(article.publishedAt!)}
            </time>
            {article.updatedAt && article.updatedAt !== article.publishedAt ? (
              <>
                {" "}
                · Updated{" "}
                <time dateTime={article.updatedAt}>
                  {articleDate(article.updatedAt)}
                </time>
              </>
            ) : null}
          </p>
        </header>
        <JsonLd data={articleSchema(article)} />
        <div className={styles.prose}>
          <Content />
        </div>
        <ArticleConversion target={article.conversionTarget} />
      </article>
    </SiteFrame>
  );
}

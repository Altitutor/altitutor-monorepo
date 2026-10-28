import Link from "next/link";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { getArticles } from "@/features/blog/articles";
import {
  categories,
  articleDate,
  articlePath,
} from "@/features/blog/catalogue";
import { blogMetadata, BLOG_DESCRIPTION } from "@/features/blog/metadata";
import styles from "@/features/blog/blog.module.css";

export const metadata = blogMetadata();
export default function BlogRoute() {
  const articles = getArticles();
  return (
    <SiteFrame>
      <div className={styles.hub}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>From Altitutor</p>
          <h1>Our blog.</h1>
          <p className={styles.lead}>{BLOG_DESCRIPTION}</p>
        </header>
        {articles.length ? (
          <>
            <nav className={styles.topics} aria-label="Blog categories">
              {Object.entries(categories)
                .filter(([category]) =>
                  articles.some((article) => article.category === category),
                )
                .map(([category, label]) => (
                  <a key={category} href={`#${category}`}>
                    {label}
                  </a>
                ))}
            </nav>
            {Object.entries(categories).map(([category, label]) => {
              const entries = articles.filter(
                (article) => article.category === category,
              );
              return entries.length ? (
                <section
                  key={category}
                  id={category}
                  className={styles.section}
                >
                  <h2>{label}</h2>
                  <div className={styles.grid}>
                    {entries.map((article) => (
                      <article key={article.slug} className={styles.card}>
                        <p className={styles.eyebrow}>
                          {categories[article.category]}
                        </p>
                        <h3>
                          <Link href={articlePath(article.slug)}>
                            {article.title}
                          </Link>
                        </h3>
                        <p>{article.description}</p>
                        <p className={styles.byline}>
                          {article.author} ·{" "}
                          <time dateTime={article.publishedAt}>
                            {articleDate(article.publishedAt!)}
                          </time>
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null;
            })}
          </>
        ) : (
          <section className={styles.empty}>
            <h2>Good things are in the works.</h2>
            <p>Our first guides and updates are on their way.</p>
            <Link href="/classes/">Explore our courses →</Link>
          </section>
        )}
      </div>
    </SiteFrame>
  );
}

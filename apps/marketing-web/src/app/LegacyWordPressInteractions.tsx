"use client";

import { useEffect } from "react";

export function LegacyWordPressInteractions() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    document.querySelectorAll<HTMLElement>(".showme").forEach((trigger) => {
      const handleClick = () => {
        document.querySelectorAll<HTMLElement>(".hiddensection1").forEach((section) => {
          section.classList.toggle("legacy-expanded");
          section.classList.remove(
            "elementor-hidden-desktop",
            "elementor-hidden-tablet",
            "elementor-hidden-mobile",
          );
        });
        trigger.classList.toggle("opened");
      };

      trigger.addEventListener("click", handleClick);
      cleanups.push(() => trigger.removeEventListener("click", handleClick));
    });

    document.querySelectorAll<HTMLElement>(".closebutton").forEach((trigger) => {
      const handleClick = () => {
        document.querySelectorAll<HTMLElement>(".hiddensection1").forEach((section) => {
          section.classList.remove("legacy-expanded");
        });
        document.querySelectorAll<HTMLElement>(".showme").forEach((showTrigger) => {
          showTrigger.classList.remove("opened");
        });
      };

      trigger.addEventListener("click", handleClick);
      cleanups.push(() => trigger.removeEventListener("click", handleClick));
    });

    document.querySelectorAll<HTMLElement>(".elementor-accordion").forEach((accordion) => {
      accordion.querySelectorAll<HTMLElement>(".elementor-tab-content").forEach((content) => {
        const title = document.getElementById(content.getAttribute("aria-labelledby") || "");
        const isActive = title?.classList.contains("elementor-active") ?? false;
        content.style.display = isActive ? "block" : "none";
      });

      accordion.querySelectorAll<HTMLElement>(".elementor-tab-title").forEach((title) => {
        const handleClick = () => {
          const contentId = title.getAttribute("aria-controls");
          const content = contentId ? document.getElementById(contentId) : null;
          const isOpening = !title.classList.contains("elementor-active");

          accordion.querySelectorAll<HTMLElement>(".elementor-tab-title").forEach((otherTitle) => {
            otherTitle.classList.remove("elementor-active");
            otherTitle.setAttribute("aria-expanded", "false");
          });
          accordion.querySelectorAll<HTMLElement>(".elementor-tab-content").forEach((panel) => {
            panel.classList.remove("elementor-active");
            panel.style.display = "none";
          });

          if (content && isOpening) {
            title.classList.add("elementor-active");
            title.setAttribute("aria-expanded", "true");
            content.classList.add("elementor-active");
            content.style.display = "block";
          }
        };

        title.addEventListener("click", handleClick);
        cleanups.push(() => title.removeEventListener("click", handleClick));
      });
    });

    document
      .querySelectorAll<HTMLElement>(".elementor-widget-testimonial-carousel")
      .forEach((widget) => {
        const slides = Array.from(widget.querySelectorAll<HTMLElement>(".swiper-slide"));
        if (slides.length <= 1) return;

        let index = Math.max(
          0,
          slides.findIndex((slide) => slide.classList.contains("swiper-slide-active")),
        );

        const previousButton = widget.querySelector<HTMLElement>(".elementor-swiper-button-prev");
        const nextButton = widget.querySelector<HTMLElement>(".elementor-swiper-button-next");
        const pagination = widget.querySelector<HTMLElement>(".swiper-pagination");

        if (pagination && pagination.children.length === 0) {
          slides.forEach((_, slideIndex) => {
            const bullet = document.createElement("button");
            bullet.type = "button";
            bullet.className = "swiper-pagination-bullet";
            bullet.setAttribute("aria-label", `Go to slide ${slideIndex + 1}`);
            pagination.appendChild(bullet);
          });
        }

        const bullets = pagination
          ? Array.from(pagination.querySelectorAll<HTMLElement>(".swiper-pagination-bullet"))
          : [];

        const showSlide = (nextIndex: number) => {
          index = (nextIndex + slides.length) % slides.length;
          slides.forEach((slide, slideIndex) => {
            slide.style.display = slideIndex === index ? "block" : "none";
            slide.classList.toggle("swiper-slide-active", slideIndex === index);
          });
          widget.style.setProperty("--legacy-carousel-slide", String(index));
          bullets.forEach((bullet, bulletIndex) => {
            bullet.classList.toggle("swiper-pagination-bullet-active", bulletIndex === index);
          });
        };

        const showPrevious = () => showSlide(index - 1);
        const showNext = () => showSlide(index + 1);

        previousButton?.addEventListener("click", showPrevious);
        nextButton?.addEventListener("click", showNext);
        bullets.forEach((bullet, bulletIndex) => {
          const handleClick = () => showSlide(bulletIndex);
          bullet.addEventListener("click", handleClick);
          cleanups.push(() => bullet.removeEventListener("click", handleClick));
        });

        if (previousButton) {
          cleanups.push(() => previousButton.removeEventListener("click", showPrevious));
        }
        if (nextButton) {
          cleanups.push(() => nextButton.removeEventListener("click", showNext));
        }

        const autoplay = window.setInterval(showNext, 5000);
        cleanups.push(() => window.clearInterval(autoplay));

        showSlide(index);
      });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}

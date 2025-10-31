/*
	Installed from https://reactbits.dev/default/
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

const DEFAULT_FROM = { opacity: 0, y: 40 };
const DEFAULT_TO = { opacity: 1, y: 0 };

const SplitText = ({
  text,
  className = "",
  delay = 100,
  duration = 0.6,
  ease = "power3.out",
  splitType = "chars",
  from = DEFAULT_FROM,
  to = DEFAULT_TO,
  threshold = 0.1,
  rootMargin = "-100px",
  textAlign = "center",
  tag = "p",
  onLetterAnimationComplete,
}) => {
  const ref = useRef(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const normalizedFrom = useMemo(
    () => ({ ...DEFAULT_FROM, ...from }),
    [from],
  );
  const normalizedTo = useMemo(
    () => ({ ...DEFAULT_TO, ...to }),
    [to],
  );

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      setFontsLoaded(true);
      return undefined;
    }

    let isMounted = true;

    if (document.fonts.status === "loaded") {
      setFontsLoaded(true);
      return () => {
        isMounted = false;
      };
    }

    document.fonts
      .ready
      .then(() => {
        if (isMounted) {
          setFontsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFontsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !text || !fontsLoaded) return;

      if (el._rbsplitInstance) {
        try {
          el._rbsplitInstance.revert();
        } catch (_) {
          /* noop */
        }
        el._rbsplitInstance = null;
      }

      const startPct = (1 - threshold) * 100;
      const [topMarginToken] = `${rootMargin}`.trim().split(/\s+/);
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(
        topMarginToken ?? "0",
      );
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || "px" : "px";
      const sign =
        marginValue === 0
          ? ""
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      const resolveTargets = (self) => {
        if (splitType.includes("chars") && self.chars.length) {
          return self.chars;
        }
        if (splitType.includes("words") && self.words.length) {
          return self.words;
        }
        if (splitType.includes("lines") && self.lines.length) {
          return self.lines;
        }
        return self.chars || self.words || self.lines;
      };

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === "lines",
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
        reduceWhiteSpace: false,
        onSplit: (self) => {
          const targets = resolveTargets(self);
          if (!targets || !targets.length) {
            return undefined;
          }

          const tween = gsap.fromTo(targets, normalizedFrom, {
            ...normalizedTo,
            duration,
            ease,
            stagger: delay / 1000,
            scrollTrigger: {
              trigger: el,
              start,
              once: true,
              fastScrollEnd: true,
              anticipatePin: 0.4,
            },
            onComplete: () => {
              onLetterAnimationComplete?.();
            },
            willChange: "transform, opacity",
            force3D: true,
          });

          return tween;
        },
      });

      el._rbsplitInstance = splitInstance;

      return () => {
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === el) st.kill();
        });
        try {
          splitInstance.revert();
        } catch (_) {
          /* noop */
        }
        el._rbsplitInstance = null;
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        normalizedFrom,
        normalizedTo,
        threshold,
        rootMargin,
        fontsLoaded,
        onLetterAnimationComplete,
      ],
      scope: ref,
    },
  );

  const justifyContent = useMemo(() => {
    if (textAlign === "center") return "center";
    if (textAlign === "right" || textAlign === "end") return "flex-end";
    return "flex-start";
  }, [textAlign]);

  const style = useMemo(
    () => ({
      textAlign,
      overflow: "hidden",
      display: "inline-flex",
      flexWrap: "wrap",
      justifyContent,
      alignItems: "baseline",
      gap: "0.25ch",
      whiteSpace: "normal",
      wordWrap: "break-word",
      willChange: "transform, opacity",
    }),
    [justifyContent, textAlign],
  );

  const classes = `split-parent ${className}`.trim();
  const Tag = tag;

  return (
    <Tag ref={ref} style={style} className={classes}>
      {text}
    </Tag>
  );
};

export default SplitText;

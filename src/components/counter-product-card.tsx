"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { money } from "@/lib/booking";
import type { CounterProduct } from "@/lib/counter-products";
import styles from "./counter-product-card.module.css";

export function CounterProductCard({ products }: { products: CounterProduct[] }) {
  const [index, setIndex] = useState(0);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const currentIndex = index < products.length ? index : 0;
  const product = products[currentIndex];
  if (!product) return null;

  const photo = product.photo_version;
  function move(step: number) {
    setIndex((currentIndex + step + products.length) % products.length);
  }

  return <section className={styles.card} aria-label="Products at the counter" data-hero="">
    <div className={styles.media}>
      <div className={styles.photo}>
        {photo && photo !== failedPhoto ? (
          <Image key={photo} src={`/product-photo/${photo}.jpg`} alt="" fill unoptimized onError={() => setFailedPhoto(photo)} />
        ) : <ShoppingBag size={34} aria-hidden="true" />}
      </div>
      {products.length > 1 && <div className={styles.controls}>
        <button type="button" onClick={() => move(-1)} aria-label="Previous product"><ChevronLeft size={19} aria-hidden="true" /></button>
        <button type="button" onClick={() => move(1)} aria-label="Next product"><ChevronRight size={19} aria-hidden="true" /></button>
      </div>}
    </div>
    <div className={styles.product} aria-live="polite" aria-atomic="true">
      <p>{product.category}</p>
      <h2>{product.name}</h2>
      <span className={styles.price}>{money(product.price_cents / 100)}</span>
      {products.length > 1 && <span className="sr-only">Product {currentIndex + 1} of {products.length}</span>}
    </div>
    <a href="#visit" className={styles.link}>Buy at the counter <ArrowUpRight size={15} aria-hidden="true" /></a>
  </section>;
}

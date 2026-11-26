"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { money } from "@/lib/booking";
import { pickupOrderPath } from "@/lib/counter-orders";
import type { CounterProduct } from "@/lib/counter-products";
import styles from "./counter-product-card.module.css";

export function CounterProductCard({ products }: { products: CounterProduct[] }) {
  const [index, setIndex] = useState(0);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const currentIndex = index < products.length ? index : 0;
  const product = products[currentIndex];
  if (!product) return null;

  const photo = product.photo_version;
  const price = money(product.price_cents / 100);
  function move(step: number) {
    setIndex((currentIndex + step + products.length) % products.length);
  }

  return <div className={styles.card} role="group" aria-label="Products at the counter">
    <div className={styles.photo}>
      {photo && photo !== failedPhoto ? (
        <Image key={photo} src={`/product-photo/${photo}.jpg`} alt="" fill unoptimized onError={() => setFailedPhoto(photo)} />
      ) : <ShoppingBag size={34} aria-hidden="true" />}
    </div>
    <div className={styles.details}>
      <p>{product.category}</p>
      <h3>{product.name}</h3>
    </div>
    <div className={styles.purchase}>
      <span className={styles.price}>{price}</span>
      {product.id && <Link
        href={pickupOrderPath(product.id)}
        className={`button button-dark ${styles.link}`}
        prefetch={false}
        aria-label={`Order for pickup: ${product.name}`}
      >
        Order for pickup <ArrowUpRight size={17} aria-hidden="true" />
      </Link>}
    </div>
    {products.length > 1 && <div className={styles.controls}>
      <button type="button" onClick={() => move(-1)} aria-label="Previous product"><ChevronLeft size={19} aria-hidden="true" /></button>
      <button type="button" onClick={() => move(1)} aria-label="Next product"><ChevronRight size={19} aria-hidden="true" /></button>
      <span className="sr-only" role="status">
        {product.name}, {price}. Product {currentIndex + 1} of {products.length}.
      </span>
    </div>}
  </div>;
}

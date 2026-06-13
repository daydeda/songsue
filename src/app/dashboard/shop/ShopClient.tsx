"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudentNav } from "@/components/layout/StudentNav";
import { useLanguage } from "@/lib/LanguageContext";
import { parseRichText } from "@/lib/rich-text";
import {
  ShoppingBag, X, ChevronLeft, ChevronRight, Upload, Loader2, CheckCircle2,
  Clock, XCircle, Package, Minus, Plus, ReceiptText,
} from "lucide-react";

interface Variant { id: string; label: string; remaining: number | null; allowCustom?: boolean }
interface Product {
  id: string; name: string; description: string; price: number;
  imageUrls: string[]; maxPerOrder: number | null; variants: Variant[];
  opensAt?: string | null; closesAt?: string | null; saleStatus?: "open" | "upcoming" | "closed";
}
interface ShopData { enabled: boolean; paymentInfo: string; qrImageUrl: string | null; products: Product[] }
interface OrderItem { productName: string; variantLabel: string; unitPrice: number; quantity: number }
interface Order {
  id: string; status: string; totalAmount: number; note: string | null;
  rejectionReason: string | null; hasSlip: boolean; createdAt: string; items: OrderItem[];
}

const baht = (n: number) => `฿${n.toLocaleString()}`;

export default function ShopClient() {
  const { lang } = useLanguage();
  const th = lang === "th";
  const [data, setData] = useState<ShopData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [active, setActive] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      fetch("/api/shop").then((r) => r.json()).catch(() => null),
      fetch("/api/shop/orders").then((r) => r.json()).catch(() => []),
    ]);
    if (s && Array.isArray(s.products)) setData(s);
    if (Array.isArray(o)) setOrders(o);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <StudentNav />
      <main className="page-container" style={{ marginTop: 40, paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <ShoppingBag size={30} strokeWidth={2.5} style={{ color: "var(--accent-primary)" }} />
          <h1 style={{ fontSize: "clamp(26px,5vw,38px)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            {th ? "ร้านค้า" : "Shop"}
          </h1>
        </div>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
          {th ? "สั่งซื้อสินค้า โอนเงิน แล้วแนบสลิปเพื่อยืนยัน" : "Order merch, transfer payment, then upload your slip to confirm."}
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["shop", "orders"] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={tab === tk ? "btn btn-primary" : "btn btn-ghost"}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              {tk === "shop" ? <Package size={16} /> : <ReceiptText size={16} />}
              {tk === "shop" ? (th ? "สินค้า" : "Products") : (th ? `คำสั่งซื้อของฉัน${orders.length ? ` (${orders.length})` : ""}` : `My Orders${orders.length ? ` (${orders.length})` : ""}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : tab === "shop" ? (
          !data || !data.enabled ? (
            <EmptyState icon={<ShoppingBag size={40} />} text={th ? "ขณะนี้ร้านค้าปิดทำการ" : "The shop is currently closed."} />
          ) : data.products.length === 0 ? (
            <EmptyState icon={<Package size={40} />} text={th ? "ยังไม่มีสินค้า" : "No products yet."} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 20 }}>
              {data.products.map((p) => <ProductCard key={p.id} product={p} th={th} onOpen={() => setActive(p)} />)}
            </div>
          )
        ) : (
          <OrdersList orders={orders} th={th} />
        )}
      </main>

      {active && data && (
        <ProductModal
          product={active}
          settings={data}
          th={th}
          onClose={() => setActive(null)}
          onOrdered={async () => {
            setActive(null);
            showToast(th ? "ส่งคำสั่งซื้อแล้ว! รอแอดมินตรวจสอบสลิป" : "Order placed! Awaiting admin slip review.");
            setTab("orders");
            await load();
          }}
        />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 3000, background: "var(--text-primary)", color: "var(--bg-base)", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.2)", maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <p style={{ fontSize: 15 }}>{text}</p>
    </div>
  );
}

function ProductCard({ product, th, onOpen }: { product: Product; th: boolean; onOpen: () => void }) {
  const cover = product.imageUrls[0];
  const soldOut = product.variants.length > 0 && product.variants.every((v) => v.remaining != null && v.remaining <= 0);
  const closed = product.saleStatus === "closed";
  const upcoming = product.saleStatus === "upcoming";
  const overlayText = closed ? (th ? "ปิดการขาย" : "CLOSED") : upcoming ? (th ? "เร็วๆ นี้" : "COMING SOON") : soldOut ? (th ? "สินค้าหมด" : "SOLD OUT") : null;
  const hasDesc = product.description.trim() !== "";
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ textAlign: "left", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      <div style={{ aspectRatio: "1", background: "var(--bg-elevated)", position: "relative" }}>
        {cover ? (
          <img src={cover} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}><Package size={40} /></div>
        )}
        {overlayText && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "0.05em" }}>
            {overlayText}
          </div>
        )}
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>{product.name}</p>
        {hasDesc && (
          <>
            <div
              style={{
                fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 2,
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                overflowWrap: "anywhere", wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: parseRichText(product.description) }}
            />
            <span style={{ color: "var(--accent-primary)", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
              {th ? "อ่านเพิ่มเติม..." : "Read more..."}
            </span>
          </>
        )}
        <p style={{ fontWeight: 800, fontSize: 16, color: "var(--accent-primary)", marginTop: "auto" }}>{baht(product.price)}</p>
      </div>
    </div>
  );
}

function ProductModal({ product, settings, th, onClose, onOrdered }: {
  product: Product; settings: ShopData; th: boolean; onClose: () => void; onOrdered: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [variantId, setVariantId] = useState<string>(() => {
    const firstAvailable = product.variants.find((v) => v.remaining == null || v.remaining > 0);
    return firstAvailable?.id ?? product.variants[0]?.id ?? "";
  });
  const [qtyRaw, setQty] = useState(1);
  const [customValue, setCustomValue] = useState("");
  const [step, setStep] = useState<"select" | "pay">("select");
  const [slipPath, setSlipPath] = useState<string | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const variant = product.variants.find((v) => v.id === variantId);
  const remaining = variant?.remaining ?? null;
  const maxQty = useMemo(() => {
    const caps = [99];
    if (remaining != null) caps.push(remaining);
    if (product.maxPerOrder != null) caps.push(product.maxPerOrder);
    return Math.max(1, Math.min(...caps));
  }, [remaining, product.maxPerOrder]);

  // Clamp at render instead of in an effect: variant changes can shrink maxQty.
  const qty = Math.min(qtyRaw, maxQty);
  const total = product.price * qty;
  const hasImages = product.imageUrls.length > 0;
  const notOpen = product.saleStatus && product.saleStatus !== "open";
  const fmt = (iso: string) => new Date(iso).toLocaleString(th ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  const uploadSlip = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/shop/slip", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      setSlipPath(d.path);
      setSlipPreview(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!slipPath) { setError(th ? "กรุณาแนบสลิปการโอนเงิน" : "Please upload your payment slip."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ variantId, quantity: qty, customValue: variant?.allowCustom ? customValue.trim() : undefined }], slipPath, note: note || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Order failed");
      onOrdered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 560, maxHeight: "94vh", border: "1px solid var(--border-subtle)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <p style={{ fontWeight: 800, fontSize: 16, paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step === "select" ? product.name : (th ? "ชำระเงิน & แนบสลิป" : "Pay & upload slip")}</p>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6, flexShrink: 0 }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16 }}>
          {step === "select" ? (
            <>
              {/* Image carousel */}
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", position: "relative", overflow: "hidden", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                {hasImages ? (
                  <img src={product.imageUrls[imgIdx]} alt={product.name} style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "var(--text-muted)" }}><Package size={48} /></div>
                )}
                {product.imageUrls.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx((i) => (i - 1 + product.imageUrls.length) % product.imageUrls.length)} style={navBtn("left")}><ChevronLeft size={20} /></button>
                    <button onClick={() => setImgIdx((i) => (i + 1) % product.imageUrls.length)} style={navBtn("right")}><ChevronRight size={20} /></button>
                    <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                      {product.imageUrls.map((_, i) => (
                        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.5)" }} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <p style={{ fontWeight: 800, fontSize: 22, color: "var(--accent-primary)", marginBottom: 12 }}>{baht(product.price)}</p>

              {/* Sale schedule notice */}
              {(product.saleStatus === "upcoming" || product.saleStatus === "closed" || product.closesAt) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-md)", background: product.saleStatus === "open" ? "var(--bg-base)" : "rgba(245,158,11,0.1)", color: product.saleStatus === "open" ? "var(--text-secondary)" : "#b45309" }}>
                  <Clock size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {product.saleStatus === "upcoming" && product.opensAt ? (th ? `เปิดขาย ${fmt(product.opensAt)}` : `Opens ${fmt(product.opensAt)}`)
                      : product.saleStatus === "closed" ? (th ? "ปิดการขายแล้ว" : "Sales have closed")
                      : product.closesAt ? (th ? `ปิดรับ ${fmt(product.closesAt)}` : `Closes ${fmt(product.closesAt)}`)
                      : null}
                  </span>
                </div>
              )}

              {product.description.trim() !== "" && (
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6, overflowWrap: "anywhere", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: parseRichText(product.description) }} />
              )}

              {/* Variant picker */}
              {product.variants.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "ตัวเลือก / ไซส์" : "Option / Size"}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.variants.map((v) => {
                      const out = v.remaining != null && v.remaining <= 0;
                      const sel = v.id === variantId;
                      return (
                        <button key={v.id} disabled={out} onClick={() => { setVariantId(v.id); setCustomValue(""); }}
                          style={{ padding: "8px 14px", borderRadius: "var(--radius-md)", border: `2px solid ${sel ? "var(--accent-primary)" : "var(--border-subtle)"}`, background: sel ? "var(--accent-glow)" : "var(--bg-base)", fontWeight: 700, fontSize: 13, cursor: out ? "not-allowed" : "pointer", opacity: out ? 0.4 : 1, textDecoration: out ? "line-through" : "none", maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", textAlign: "left", lineHeight: 1.35 }}>
                          {v.label}{v.remaining != null ? ` (${Math.max(0, v.remaining)})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom value for an "Other (specify)" option */}
              {variant?.allowCustom && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "ระบุรายละเอียด *" : "Please specify *"}</label>
                  <input
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    maxLength={120}
                    placeholder={th ? "พิมพ์รายละเอียดที่ต้องการ เช่น ไซส์/สีที่ต้องการ" : "Type your request, e.g. desired size/colour"}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontSize: 14, fontFamily: "inherit", background: "var(--bg-base)" }}
                  />
                </div>
              )}

              {/* Quantity */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "จำนวน" : "Quantity"}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="btn btn-ghost" style={{ padding: 8 }}><Minus size={16} /></button>
                  <span style={{ fontWeight: 800, fontSize: 18, minWidth: 32, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} className="btn btn-ghost" style={{ padding: 8 }}><Plus size={16} /></button>
                  {product.maxPerOrder != null && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{th ? `จำกัด ${product.maxPerOrder} ชิ้น/คน` : `Max ${product.maxPerOrder} per person`}</span>
                  )}
                </div>
              </div>

              {error && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</p>}

              <button onClick={() => setStep("pay")} disabled={!variant || (remaining != null && remaining <= 0) || (!!variant?.allowCustom && !customValue.trim()) || !!notOpen} className="btn btn-primary" style={{ width: "100%", marginTop: 20, justifyContent: "space-between", display: "flex" }}>
                <span>{notOpen ? (product.saleStatus === "upcoming" ? (th ? "ยังไม่เปิดขาย" : "Not on sale yet") : (th ? "ปิดการขาย" : "Sales closed")) : (th ? "ดำเนินการต่อ" : "Continue")}</span>
                {!notOpen && <span>{baht(total)}</span>}
              </button>
            </>
          ) : (
            <>
              {/* Order summary */}
              <div style={{ background: "var(--bg-base)", borderRadius: "var(--radius-md)", padding: 14, marginBottom: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, marginBottom: 4 }}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>{product.name}{variant && product.variants.length > 1 ? ` · ${variant.label}` : ""} × {qty}</span>
                  <span style={{ fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{baht(total)}</span>
                </div>
              </div>

              {/* Payment instructions + QR */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "ช่องทางการชำระเงิน" : "How to pay"}</label>
                {settings.qrImageUrl && (
                  <img src={settings.qrImageUrl} alt="Payment QR" style={{ width: 200, height: 200, objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", display: "block", margin: "0 auto 12px", background: "#fff" }} />
                )}
                {settings.paymentInfo.trim() !== "" && (
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, textAlign: "center", overflowWrap: "anywhere", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: parseRichText(settings.paymentInfo) }} />
                )}
              </div>

              {/* Slip upload */}
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "แนบสลิปการโอนเงิน *" : "Upload payment slip *"}</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSlip(f); }} />
              {slipPreview ? (
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <img src={slipPreview} alt="slip" style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-base)" }} />
                  <button onClick={() => { setSlipPath(null); setSlipPreview(null); fileRef.current && (fileRef.current.value = ""); }} className="btn btn-ghost" style={{ position: "absolute", top: 8, right: 8, padding: 6, background: "var(--bg-surface)" }}><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "100%", padding: 24, borderRadius: "var(--radius-md)", border: "2px dashed var(--border-subtle)", background: "var(--bg-base)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-muted)", marginBottom: 16 }}>
                  {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{uploading ? (th ? "กำลังอัปโหลด…" : "Uploading…") : (th ? "แตะเพื่อเลือกรูปสลิป" : "Tap to choose slip image")}</span>
                </button>
              )}

              {/* Note */}
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{th ? "หมายเหตุ (ไม่บังคับ)" : "Note (optional)"}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={th ? "เช่น ชื่อบนสลิป, ขนาดที่ต้องการ" : "e.g. name on slip, pickup details"} style={{ width: "100%", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontSize: 14, fontFamily: "inherit", background: "var(--bg-base)", resize: "vertical", marginBottom: 16 }} />

              {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("select")} className="btn btn-ghost" style={{ flex: 1 }}>{th ? "ย้อนกลับ" : "Back"}</button>
                <button onClick={submit} disabled={submitting || uploading || !slipPath} className="btn btn-primary" style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {th ? "ยืนยันคำสั่งซื้อ" : "Place order"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersList({ orders, th }: { orders: Order[]; th: boolean }) {
  if (orders.length === 0) {
    return <EmptyState icon={<ReceiptText size={40} />} text={th ? "ยังไม่มีคำสั่งซื้อ" : "No orders yet."} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {orders.map((o) => <OrderRow key={o.id} order={o} th={th} />)}
    </div>
  );
}

function OrderRow({ order, th }: { order: Order; th: boolean }) {
  const [showSlip, setShowSlip] = useState(false);
  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          {order.items.map((i, idx) => (
            <p key={idx} style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere", wordBreak: "break-word" }}>{i.productName}{i.variantLabel && i.variantLabel !== "Standard" ? ` · ${i.variantLabel}` : ""} × {i.quantity}</p>
          ))}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{new Date(order.createdAt).toLocaleString(th ? "th-TH" : "en-GB")}</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
          {badge.icon}{th ? badge.th : badge.en}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>{baht(order.totalAmount)}</span>
        {order.hasSlip && (
          <button onClick={() => setShowSlip((s) => !s)} className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }}>
            {showSlip ? (th ? "ซ่อนสลิป" : "Hide slip") : (th ? "ดูสลิป" : "View slip")}
          </button>
        )}
      </div>
      {order.status === "rejected" && order.rejectionReason && (
        <p style={{ marginTop: 10, fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.06)", padding: "8px 12px", borderRadius: 8 }}>
          {th ? "เหตุผล: " : "Reason: "}{order.rejectionReason}
        </p>
      )}
      {showSlip && order.hasSlip && (
        <img src={`/api/shop/orders/${order.id}/slip`} alt="slip" style={{ marginTop: 12, width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-base)" }} />
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, { th: string; en: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending: { th: "รอตรวจสอบ", en: "Pending", bg: "rgba(245,158,11,0.12)", color: "#b45309", icon: <Clock size={13} /> },
  approved: { th: "อนุมัติแล้ว", en: "Approved", bg: "rgba(22,163,74,0.12)", color: "#15803d", icon: <CheckCircle2 size={13} /> },
  rejected: { th: "ถูกปฏิเสธ", en: "Rejected", bg: "rgba(239,68,68,0.12)", color: "#dc2626", icon: <XCircle size={13} /> },
};

const navBtn = (side: "left" | "right"): React.CSSProperties => ({
  position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)",
  width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.45)",
  color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
});

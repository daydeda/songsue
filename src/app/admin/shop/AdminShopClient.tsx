"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  ShoppingBag, Package, ReceiptText, Settings as SettingsIcon, Plus, Trash2, Pencil,
  Upload, Loader2, X, CheckCircle2, XCircle, Clock, GripVertical, Save, RotateCcw, Download,
} from "lucide-react";

const baht = (n: number) => `฿${n.toLocaleString()}`;

interface AdminVariant { id?: string; label: string; stock: number | null; allowCustom?: boolean; sold?: number }
interface AdminProduct {
  id: string; name: string; description: string; price: number; imageUrls: string[];
  maxPerOrder: number | null; opensAt: string | null; closesAt: string | null;
  isActive: boolean; sortOrder: number; variants: AdminVariant[];
}

// ISO/Date -> value for <input type="datetime-local"> (local time, no seconds).
function toLocalInput(d?: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
interface AdminOrder {
  id: string; status: string; totalAmount: number; note: string | null; rejectionReason: string | null;
  hasSlip: boolean; createdAt: string; reviewedAt: string | null;
  buyer: { name: string | null; studentId: string | null; nickname: string | null };
  items: { productName: string; variantLabel: string; unitPrice: number; quantity: number }[];
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await res.json();
  if (!res.ok || !d.url) throw new Error(d.error || "Upload failed");
  return d.url as string;
}

interface ProductOrderRow {
  orderId: string; status: string; createdAt: string; reviewedAt: string | null;
  rejectionReason: string | null; orderTotal: number; slipPath: string | null; note: string | null;
  variantLabel: string; quantity: number; unitPrice: number;
  buyerName: string | null; nickname: string | null; studentId: string | null;
  email: string | null; phone: string | null; major: string | null; houseId: string | null;
}

// Export every order for one product to a real .xlsx with two sheets: a "Summary"
// of quantities per option (so admins can see how many of each size to make) and
// an "Orders" sheet (one row per buyer line, with autofilter) so they can filter
// by status/option in Excel. Times are rendered in Bangkok regardless of device
// timezone. xlsx is imported lazily (same pattern as the events export).
async function exportProductXlsx(p: AdminProduct) {
  const XLSX = await import("xlsx");
  const data = await fetch(`/api/admin/shop/products/${p.id}/orders`).then((r) => r.json()).catch(() => null);
  const rows: ProductOrderRow[] = data?.rows ?? [];
  const dt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) : "");

  // Summary sheet: quantity per option, split by status (rejected excluded from the active total).
  const byOption = new Map<string, { approved: number; pending: number; rejected: number }>();
  for (const r of rows) {
    const k = r.variantLabel || "—";
    const cur = byOption.get(k) ?? { approved: 0, pending: 0, rejected: 0 };
    if (r.status === "rejected") cur.rejected += r.quantity;
    else if (r.status === "approved") cur.approved += r.quantity;
    else cur.pending += r.quantity;
    byOption.set(k, cur);
  }
  const sumAoa: (string | number)[][] = [["Option", "Approved", "Pending", "Rejected", "Active total (Approved+Pending)"]];
  let tA = 0, tP = 0, tR = 0;
  for (const [k, v] of byOption) {
    sumAoa.push([k, v.approved, v.pending, v.rejected, v.approved + v.pending]);
    tA += v.approved; tP += v.pending; tR += v.rejected;
  }
  sumAoa.push(["TOTAL", tA, tP, tR, tA + tP]);
  const wsSum = XLSX.utils.aoa_to_sheet(sumAoa);
  wsSum["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];

  // Orders sheet: one row per order line with every detail, autofilter on for easy filtering.
  const header = [
    "Name", "Nickname", "Student ID", "Major", "House", "Email", "Phone",
    "Option", "Qty", "Unit price (THB)", "Subtotal (THB)",
    "Status", "Ordered (Bangkok)", "Reviewed (Bangkok)", "Rejection reason",
    "Slip uploaded", "Order total (THB)", "Note", "Order ID",
  ];
  const wsRows = rows.map((r) => ({
    "Name": r.buyerName ?? "",
    "Nickname": r.nickname ?? "",
    "Student ID": r.studentId ?? "",
    "Major": r.major ?? "",
    "House": r.houseId ?? "",
    "Email": r.email ?? "",
    "Phone": r.phone ?? "",
    "Option": r.variantLabel,
    "Qty": r.quantity,
    "Unit price (THB)": r.unitPrice,
    "Subtotal (THB)": r.unitPrice * r.quantity,
    "Status": r.status,
    "Ordered (Bangkok)": dt(r.createdAt),
    "Reviewed (Bangkok)": dt(r.reviewedAt),
    "Rejection reason": r.rejectionReason ?? "",
    "Slip uploaded": r.slipPath ? "Yes" : "No",
    "Order total (THB)": r.orderTotal,
    "Note": r.note ?? "",
    "Order ID": r.orderId,
  }));
  const ws = XLSX.utils.json_to_sheet(wsRows, { header });
  ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
  ws["!cols"] = header.map((h) => ({ wch: Math.min(40, Math.max(10, h.length + 2)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSum, "Summary");
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  // Keep Unicode (Thai) intact; strip only filename-illegal chars and collapse whitespace.
  const safe = (data?.productName || p.name)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "") || "product";
  XLSX.writeFile(wb, `product_${safe}.xlsx`);
}

export default function AdminShopClient() {
  const { lang } = useLanguage();
  const th = lang === "th";
  const [tab, setTab] = useState<"products" | "orders" | "settings">("products");

  return (
    <div className="pb-20">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <ShoppingBag size={32} strokeWidth={2.5} style={{ color: "var(--accent-primary)" }} />
        <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, letterSpacing: "-0.03em" }}>{th ? "จัดการร้านค้า" : "Manage Shop"}</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {([["products", Package, th ? "สินค้า" : "Products"], ["orders", ReceiptText, th ? "คำสั่งซื้อ" : "Orders"], ["settings", SettingsIcon, th ? "ตั้งค่า" : "Settings"]] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)} className={tab === k ? "btn btn-primary" : "btn btn-ghost"} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab th={th} />}
      {tab === "orders" && <OrdersTab th={th} />}
      {tab === "settings" && <SettingsTab th={th} />}
    </div>
  );
}

/* ------------------------------- Products ------------------------------- */

function ProductsTab({ th }: { th: boolean }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const exportProduct = async (p: AdminProduct) => {
    setExportingId(p.id);
    try { await exportProductXlsx(p); } catch { /* surfaced via empty file is unlikely; ignore */ } finally { setExportingId(null); }
  };

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/shop/products").then((r) => r.json()).catch(() => []);
    if (Array.isArray(d)) setProducts(d);
    setLoading(false);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (p: AdminProduct) => {
    if (!confirm(th ? `ลบสินค้า "${p.name}"? คำสั่งซื้อเดิมจะยังเก็บไว้` : `Delete "${p.name}"? Existing orders are kept.`)) return;
    await fetch(`/api/admin/shop/products/${p.id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <button onClick={() => setEditing("new")} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Plus size={18} />{th ? "เพิ่มสินค้า" : "New product"}
      </button>

      {products.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>{th ? "ยังไม่มีสินค้า" : "No products yet."}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {products.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", overflow: "hidden", flexShrink: 0 }}>
                {p.imageUrls[0] ? <img src={p.imageUrls[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}><Package size={20} /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, overflowWrap: "anywhere", wordBreak: "break-word" }}>{p.name} {!p.isActive && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>({th ? "ซ่อน" : "hidden"})</span>}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  {baht(p.price)} · {p.variants.map((v) => `${v.label}${v.stock != null ? ` ${Math.max(0, v.stock - (v.sold ?? 0))}/${v.stock}` : ""}`).join(", ")}
                  {p.maxPerOrder != null ? ` · ${th ? "จำกัด" : "max"} ${p.maxPerOrder}/${th ? "คน" : "person"}` : ""}
                </p>
                {(p.opensAt || p.closesAt) && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    🕒 {p.opensAt ? new Date(p.opensAt).toLocaleString(th ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : (th ? "เปิดอยู่" : "now")} → {p.closesAt ? new Date(p.closesAt).toLocaleString(th ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : (th ? "ไม่กำหนด" : "open-ended")}
                  </p>
                )}
              </div>
              <button onClick={() => exportProduct(p)} disabled={exportingId === p.id} className="btn btn-ghost" style={{ padding: 8 }} title={th ? "ส่งออกคำสั่งซื้อเป็น .xlsx" : "Export orders to .xlsx"}>
                {exportingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              </button>
              <button onClick={() => setEditing(p)} className="btn btn-ghost" style={{ padding: 8 }}><Pencil size={16} /></button>
              <button onClick={() => remove(p)} className="btn btn-ghost" style={{ padding: 8, color: "#ef4444" }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProductForm
          th={th}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ th, product, onClose, onSaved }: { th: boolean; product: AdminProduct | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.imageUrls ?? []);
  const [maxPerOrder, setMaxPerOrder] = useState<string>(product?.maxPerOrder != null ? String(product.maxPerOrder) : "");
  const [opensAt, setOpensAt] = useState<string>(toLocalInput(product?.opensAt));
  const [closesAt, setClosesAt] = useState<string>(toLocalInput(product?.closesAt));
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [variants, setVariants] = useState<AdminVariant[]>(product?.variants?.length ? product.variants : [{ label: "Standard", stock: null, allowCustom: false }]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadImage(f);
        setImageUrls((prev) => [...prev, url]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const setVariant = (i: number, patch: Partial<AdminVariant>) => setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError(th ? "กรุณากรอกชื่อสินค้า" : "Product name is required"); return; }
    if (variants.length === 0 || variants.some((v) => !v.label.trim())) { setError(th ? "ทุกตัวเลือกต้องมีชื่อ" : "Every option needs a label"); return; }
    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) { setError(th ? "เวลาปิดต้องอยู่หลังเวลาเปิด" : "Close time must be after open time"); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description,
        price: Math.round(price) || 0,
        imageUrls,
        maxPerOrder: maxPerOrder.trim() === "" ? null : Math.max(1, Math.round(Number(maxPerOrder))),
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        isActive,
        sortOrder: product?.sortOrder ?? 0,
        variants: variants.map((v) => ({ id: v.id, label: v.label.trim(), stock: v.stock, allowCustom: !!v.allowCustom })),
      };
      const res = await fetch(product ? `/api/admin/shop/products/${product.id}` : "/api/admin/shop/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 640, maxHeight: "94vh", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>{product ? (th ? "แก้ไขสินค้า" : "Edit product") : (th ? "เพิ่มสินค้า" : "New product")}</p>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6 }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label={th ? "ชื่อสินค้า" : "Name"}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder={th ? "เช่น เสื้อค่าย SMO" : "e.g. SMO Camp Shirt"} />
          </Field>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Field label={th ? "ราคา (บาท)" : "Price (฿)"} style={{ flex: 1, minWidth: 140 }}>
              <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} style={inputStyle} />
            </Field>
            <Field label={th ? "จำกัดต่อคน (เว้นว่าง=ไม่จำกัด)" : "Max per buyer (blank = unlimited)"} style={{ flex: 1, minWidth: 160 }}>
              <input type="number" min={1} value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value)} style={inputStyle} placeholder={th ? "ไม่จำกัด" : "Unlimited"} />
            </Field>
          </div>

          {/* Sale schedule (optional) */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Field label={th ? "เปิดขาย (ไม่บังคับ)" : "Opens at (optional)"} style={{ flex: 1, minWidth: 150 }}>
              <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} style={inputStyle} />
            </Field>
            <Field label={th ? "ปิดขาย (ไม่บังคับ)" : "Closes at (optional)"} style={{ flex: 1, minWidth: 150 }}>
              <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          {/* Images */}
          <Field label={th ? "รูปสินค้า (รูปแรก = หน้าปก)" : "Posters (first = cover)"}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {imageUrls.map((url, i) => (
                <div key={url} style={{ position: "relative", width: 80, height: 80, borderRadius: "var(--radius-md)", overflow: "hidden", border: i === 0 ? "2px solid var(--accent-primary)" : "1px solid var(--border-subtle)" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))} style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
                  {i !== 0 && <button onClick={() => setImageUrls((prev) => { const a = [...prev]; const [m] = a.splice(i, 1); a.unshift(m); return a; })} title={th ? "ตั้งเป็นหน้าปก" : "Make cover"} style={{ position: "absolute", bottom: 2, left: 2, fontSize: 9, padding: "1px 4px", border: "none", borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer" }}>★</button>}
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 80, height: 80, borderRadius: "var(--radius-md)", border: "2px dashed var(--border-subtle)", background: "var(--bg-base)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value = ""; }} />
            </div>
          </Field>

          {/* Description */}
          <Field label={th ? "รายละเอียด" : "Description"}>
            <RichTextEditor value={description} onChange={setDescription} rows={4} placeholder={th ? "รายละเอียดสินค้า…" : "Product details…"} />
          </Field>

          {/* Variants */}
          <Field label={th ? "ตัวเลือก / ไซส์ (สต็อกเว้นว่าง = ไม่จำกัด)" : "Options / sizes (blank stock = unlimited)"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {variants.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <GripVertical size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <input value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} placeholder={v.allowCustom ? (th ? "ชื่อ เช่น อื่นๆ" : "Label e.g. Other") : (th ? "ชื่อ เช่น S, M, L" : "Label e.g. S, M, L")} style={{ ...inputStyle, flex: 2, minWidth: 120 }} />
                  <input type="number" min={0} value={v.stock ?? ""} onChange={(e) => setVariant(i, { stock: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} placeholder={th ? "สต็อก" : "Stock"} style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }} title={th ? "ให้ผู้ซื้อพิมพ์รายละเอียดเอง" : "Buyer types their own value"}>
                    <input type="checkbox" checked={!!v.allowCustom} onChange={(e) => setVariant(i, { allowCustom: e.target.checked })} />
                    {th ? "ระบุเอง" : "Other"}
                  </label>
                  {variants.length > 1 && <button onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="btn btn-ghost" style={{ padding: 6, color: "#ef4444" }}><Trash2 size={15} /></button>}
                </div>
              ))}
              <button onClick={() => setVariants((vs) => [...vs, { label: "", stock: null, allowCustom: false }])} className="btn btn-ghost" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Plus size={15} />{th ? "เพิ่มตัวเลือก" : "Add option"}
              </button>
            </div>
          </Field>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{th ? "แสดงในร้านค้า" : "Visible in shop"}</span>
          </label>
        </div>

        {/* Sticky footer actions */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border-subtle)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>{th ? "ยกเลิก" : "Cancel"}</button>
            <button onClick={save} disabled={saving || uploading} className="btn btn-primary" style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving && <Loader2 size={16} className="animate-spin" />}<Save size={16} />{th ? "บันทึก" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Orders -------------------------------- */

function OrdersTab({ th }: { th: boolean }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  // Reject/revert open a custom modal instead of the browser prompt/confirm.
  const [pending, setPending] = useState<{ order: AdminOrder; action: "reject" | "revert" } | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/shop/orders").then((r) => r.json()).catch(() => []);
    if (Array.isArray(d)) setOrders(d);
    setLoading(false);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Approve runs immediately; reject/revert defer to the modal which calls submit().
  const review = (o: AdminOrder, action: "approve" | "reject" | "revert") => {
    if (action === "approve") { submit(o, "approve"); return; }
    setPending({ order: o, action });
  };

  const submit = async (o: AdminOrder, action: "approve" | "reject" | "revert", rejectionReason?: string) => {
    setBusy(o.id);
    await fetch(`/api/admin/shop/orders/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason }),
    });
    setBusy(null);
    setPending(null);
    load();
  };

  if (loading) return <Spinner />;

  const shown = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? "btn btn-primary" : "btn btn-ghost"} style={{ fontSize: 13, padding: "6px 14px" }}>
            {f === "all" ? (th ? "ทั้งหมด" : "All") : f === "pending" ? (th ? "รอตรวจสอบ" : "Pending") : f === "approved" ? (th ? "อนุมัติ" : "Approved") : (th ? "ปฏิเสธ" : "Rejected")}
            {" "}({orders.filter((o) => f === "all" || o.status === f).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>{th ? "ไม่มีคำสั่งซื้อ" : "No orders."}</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {shown.map((o) => <AdminOrderRow key={o.id} order={o} th={th} busy={busy === o.id} onReview={review} />)}
        </div>
      )}

      {pending && (
        <ReviewModal
          th={th}
          order={pending.order}
          action={pending.action}
          busy={busy === pending.order.id}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => submit(pending.order, pending.action, reason)}
        />
      )}
    </div>
  );
}

// Custom confirmation modal for the two non-trivial order actions: rejecting
// (needs a buyer-visible reason) and reverting an approved/rejected order back
// to pending. Mirrors ProductForm's overlay styling.
function ReviewModal({ th, order, action, busy, onCancel, onConfirm }: {
  th: boolean; order: AdminOrder; action: "reject" | "revert"; busy: boolean;
  onCancel: () => void; onConfirm: (rejectionReason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isReject = action === "reject";
  const buyerName = order.buyer.name ?? order.buyer.nickname ?? (th ? "ผู้ซื้อรายนี้" : "this buyer");

  const confirm = () => onConfirm(isReject ? reason.trim() : undefined);

  return (
    <div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 2500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 460, border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <p style={{ fontWeight: 800, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {isReject ? <XCircle size={18} style={{ color: "#ef4444" }} /> : <RotateCcw size={18} style={{ color: "#b45309" }} />}
            {isReject ? (th ? "ปฏิเสธคำสั่งซื้อ" : "Reject order") : (th ? "ย้อนกลับเป็นรอตรวจสอบ" : "Revert to pending")}
          </p>
          <button onClick={onCancel} disabled={busy} className="btn btn-ghost" style={{ padding: 6 }}><X size={20} /></button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            {isReject
              ? (th ? `ปฏิเสธคำสั่งซื้อของ ${buyerName}? ผู้ซื้อจะเห็นเหตุผลด้านล่าง` : `Reject ${buyerName}'s order? The buyer will see the reason below.`)
              : (th ? `ย้อนคำสั่งซื้อของ ${buyerName} กลับเป็น "รอตรวจสอบ" เพื่อตรวจใหม่?` : `Send ${buyerName}'s order back to "pending" to re-check it?`)}
          </p>

          {isReject && (
            <Field label={th ? "เหตุผลที่ปฏิเสธ (ผู้ซื้อจะเห็น)" : "Rejection reason (buyer will see)"}>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder={th ? "เช่น สลิปไม่ชัด / ยอดเงินไม่ตรง" : "e.g. Slip unclear / amount doesn't match"}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "12px 16px", display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={busy} className="btn btn-ghost" style={{ flex: 1 }}>{th ? "ยกเลิก" : "Cancel"}</button>
          <button
            onClick={confirm}
            disabled={busy}
            className={isReject ? "btn btn-ghost" : "btn btn-primary"}
            style={{
              flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              ...(isReject ? { color: "#fff", background: "#ef4444" } : {}),
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : (isReject ? <XCircle size={16} /> : <RotateCcw size={16} />)}
            {isReject ? (th ? "ปฏิเสธ" : "Reject") : (th ? "ย้อนกลับ" : "Revert")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminOrderRow({ order, th, busy, onReview }: { order: AdminOrder; th: boolean; busy: boolean; onReview: (o: AdminOrder, a: "approve" | "reject" | "revert") => void }) {
  const [showSlip, setShowSlip] = useState(order.status === "pending");
  const badge = ORDER_BADGE[order.status] ?? ORDER_BADGE.pending;
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{order.buyer.name ?? "—"} {order.buyer.nickname ? <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({order.buyer.nickname})</span> : null}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{order.buyer.studentId ?? ""} · {new Date(order.createdAt).toLocaleString(th ? "th-TH" : "en-GB")}</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: badge.bg, color: badge.color, height: "fit-content", whiteSpace: "nowrap" }}>{badge.icon}{th ? badge.th : badge.en}</span>
      </div>

      <div style={{ fontSize: 14, marginBottom: 8 }}>
        {order.items.map((i, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>{i.productName}{i.variantLabel && i.variantLabel !== "Standard" ? ` · ${i.variantLabel}` : ""} × {i.quantity}</span>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>{baht(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
          <span>{th ? "รวม" : "Total"}</span><span>{baht(order.totalAmount)}</span>
        </div>
      </div>

      {order.note && <p style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-base)", padding: "8px 12px", borderRadius: 8, marginBottom: 8 }}>📝 {order.note}</p>}
      {order.status === "rejected" && order.rejectionReason && <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 8 }}>{th ? "เหตุผล: " : "Reason: "}{order.rejectionReason}</p>}

      {order.hasSlip ? (
        <>
          <button onClick={() => setShowSlip((s) => !s)} className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px", marginBottom: showSlip ? 10 : 0 }}>{showSlip ? (th ? "ซ่อนสลิป" : "Hide slip") : (th ? "ดูสลิป" : "View slip")}</button>
          {showSlip && <img src={`/api/shop/orders/${order.id}/slip`} alt="slip" style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-base)", marginBottom: 10 }} />}
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{th ? "ไม่มีสลิป" : "No slip uploaded"}</p>
      )}

      {order.status === "pending" ? (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={() => onReview(order, "reject")} disabled={busy} className="btn btn-ghost" style={{ flex: 1, color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><XCircle size={16} />{th ? "ปฏิเสธ" : "Reject"}</button>
          <button onClick={() => onReview(order, "approve")} disabled={busy} className="btn btn-primary" style={{ flex: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{th ? "อนุมัติ" : "Approve"}</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => onReview(order, "revert")}
            disabled={busy}
            className="btn btn-ghost"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
              padding: "6px 12px",
              background: "rgba(245,158,11,0.12)", color: "#b45309",
              border: "1px solid rgba(245,158,11,0.25)",
            }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}{th ? "ย้อนกลับเป็นรอตรวจสอบ" : "Revert to pending"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Settings ------------------------------- */

function SettingsTab({ th }: { th: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/shop/settings").then((r) => r.json()).then((d) => {
      if (d) { setEnabled(!!d.enabled); setPaymentInfo(d.paymentInfo ?? ""); setQrImageUrl(d.qrImageUrl ?? null); }
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, paymentInfo, qrImageUrl: qrImageUrl || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24, maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>{th ? "เปิดร้านค้า" : "Shop open"}</span>
      </label>

      <Field label={th ? "QR พร้อมเพย์ / บัญชีธนาคาร" : "PromptPay / bank QR"}>
        {qrImageUrl ? (
          <div style={{ position: "relative", width: 200 }}>
            <img src={qrImageUrl} alt="QR" style={{ width: 200, height: 200, objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "#fff" }} />
            <button onClick={() => setQrImageUrl(null)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 200, height: 200, borderRadius: "var(--radius-md)", border: "2px dashed var(--border-subtle)", background: "var(--bg-base)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
            {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
            <span style={{ fontSize: 12 }}>{th ? "อัปโหลด QR" : "Upload QR"}</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setUploading(true); setError(null);
          try { setQrImageUrl(await uploadImage(f)); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } finally { setUploading(false); }
        }} />
      </Field>

      <Field label={th ? "คำแนะนำการชำระเงิน" : "Payment instructions"}>
        <RichTextEditor value={paymentInfo} onChange={setPaymentInfo} rows={4} placeholder={th ? "เช่น พร้อมเพย์ 08x-xxx-xxxx (ชื่อ) — โอนแล้วแนบสลิป" : "e.g. PromptPay 08x-xxx-xxxx (Name) — transfer then upload slip"} />
      </Field>

      {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={save} disabled={saving || uploading} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{th ? "บันทึก" : "Save"}
        </button>
        {savedAt && !saving && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ {th ? "บันทึกแล้ว" : "Saved"}</span>}
      </div>
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle)", fontSize: 14, fontFamily: "inherit", background: "var(--bg-base)",
};

const ORDER_BADGE: Record<string, { th: string; en: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending: { th: "รอตรวจสอบ", en: "Pending", bg: "rgba(245,158,11,0.12)", color: "#b45309", icon: <Clock size={13} /> },
  approved: { th: "อนุมัติแล้ว", en: "Approved", bg: "rgba(22,163,74,0.12)", color: "#15803d", icon: <CheckCircle2 size={13} /> },
  rejected: { th: "ถูกปฏิเสธ", en: "Rejected", bg: "rgba(239,68,68,0.12)", color: "#dc2626", icon: <XCircle size={13} /> },
};

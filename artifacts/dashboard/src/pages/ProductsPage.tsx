import { useState } from "react";
import { Plus, Pencil, Trash2, Package, Tag, Layers, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";

interface ProductForm {
  name: string;
  price: string;
  colors: string;
  stock: string;
  description: string;
  facebookPostUrl: string;
  facebookPostId: string;
  attributes: string;
}

const emptyForm: ProductForm = {
  name: "",
  price: "",
  colors: "",
  stock: "",
  description: "",
  facebookPostUrl: "",
  facebookPostId: "",
  attributes: "",
};

function ProductDialog({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product;
}) {
  const [form, setForm] = useState<ProductForm>(
    product
      ? {
          name: product.name,
          price: String(product.price),
          colors: product.colors ?? "",
          stock: product.stock != null ? String(product.stock) : "",
          description: product.description ?? "",
          facebookPostUrl: product.facebookPostUrl ?? "",
          facebookPostId: product.facebookPostId ?? "",
          attributes: product.attributes ?? "",
        }
      : emptyForm
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price) {
      toast({ title: "Validation", description: "Name and price are required", variant: "destructive" });
      return;
    }

    const data = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      colors: form.colors || null,
      stock: form.stock ? parseInt(form.stock, 10) : null,
      description: form.description || null,
      facebookPostUrl: form.facebookPostUrl || null,
      facebookPostId: form.facebookPostId || null,
      attributes: form.attributes || null,
    };

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, data });
      } else {
        await createProduct.mutateAsync({ data });
      }
      invalidate();
      onClose();
      toast({ title: "Success", description: product ? "Product updated" : "Product created" });
    } catch {
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    }
  };

  const set = (field: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Summer T-Shirt" />
          </div>
          <div className="space-y-1.5">
            <Label>Price (MAD) *</Label>
            <Input type="number" value={form.price} onChange={set("price")} placeholder="200" />
          </div>
          <div className="space-y-1.5">
            <Label>Available Colors</Label>
            <Input value={form.colors} onChange={set("colors")} placeholder="Red, Black, Blue" />
          </div>
          <div className="space-y-1.5">
            <Label>Stock Quantity</Label>
            <Input type="number" value={form.stock} onChange={set("stock")} placeholder="50" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set("description")} placeholder="Product description..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook Post URL</Label>
            <Input value={form.facebookPostUrl} onChange={set("facebookPostUrl")} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook Post ID</Label>
            <Input value={form.facebookPostId} onChange={set("facebookPostId")} placeholder="123456789" />
          </div>
          <div className="space-y-1.5">
            <Label>Additional Attributes</Label>
            <Textarea value={form.attributes} onChange={set("attributes")} placeholder="Material: Cotton 100%, Size: XS-XXL" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : product ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package size={14} className="text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">{product.name}</div>
            <div className="text-xs text-muted-foreground">
              {product.isActive ? (
                <span className="text-green-600 font-medium">Active</span>
              ) : (
                <span className="text-muted-foreground">Inactive</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <Pencil size={13} className="text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 size={13} className="text-destructive" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Tag size={11} />
          <span className="font-semibold text-foreground">{Number(product.price).toFixed(2)} MAD</span>
        </div>
        {product.stock != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers size={11} />
            <span>{product.stock} in stock</span>
          </div>
        )}
        {product.colors && (
          <div className="col-span-2 text-muted-foreground">
            <span className="font-medium text-foreground">Colors:</span> {product.colors}
          </div>
        )}
        {product.facebookPostUrl && (
          <div className="col-span-2">
            <a
              href={product.facebookPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Link size={10} />
              View Facebook Post
            </a>
          </div>
        )}
      </div>

      {product.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ListProductsResponseItem | undefined>(undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useListProducts();
  const deleteProduct = useDeleteProduct();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Deleted", description: "Product removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
    }
  };

  const openAdd = () => {
    setEditProduct(undefined);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product catalog for AI responses</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus size={14} />
          Add Product
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <Package size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No products yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first product to start using the AI assistant</p>
          <Button onClick={openAdd} className="gap-1.5">
            <Plus size={14} />
            Add Product
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p: Product) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <ProductDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditProduct(undefined); }}
          product={editProduct}
        />
      )}
    </div>
  );
}

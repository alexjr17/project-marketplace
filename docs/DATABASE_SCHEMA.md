# 🗄️ Diagrama de Base de Datos - Marketplace de Ropa Personalizada

## MODELO ENTIDAD-RELACIÓN (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIAGRAMA COMPLETO (TODAS LAS FASES)                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│       ROLES          │         │    PERMISSIONS       │
├──────────────────────┤         ├──────────────────────┤
│ id (PK)              │◄───┐    │ id (PK)              │
│ name                 │    │    │ name                 │
│ description          │    │    │ description          │
│ is_active            │    │    │ resource             │
│ created_at           │    │    │ action               │
│ updated_at           │    │    │ created_at           │
└──────────────────────┘    │    └──────────────────────┘
                            │              ▲
                            │              │
                            │    ┌─────────┴────────────┐
                            │    │  ROLE_PERMISSIONS    │
                            │    ├──────────────────────┤
                            └───►│ role_id (FK)         │
                                 │ permission_id (FK)   │
                                 │ created_at           │
                                 └──────────────────────┘
                                           ▲
                                           │
┌──────────────────────┐                  │
│       USERS          │                  │
├──────────────────────┤                  │
│ id (PK)              │──────────────────┘
│ email (UNIQUE)       │
│ password_hash        │
│ first_name           │
│ last_name            │
│ phone                │
│ role_id (FK)         │
│ avatar_url           │
│ email_verified       │
│ is_active            │
│ last_login           │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐         ┌──────────────────────┐
│      ADDRESSES       │         │  PRODUCT_CATEGORIES  │
├──────────────────────┤         ├──────────────────────┤
│ id (PK)              │         │ id (PK)              │
│ user_id (FK)         │         │ name                 │
│ label                │         │ slug                 │
│ street               │         │ description          │
│ city                 │         │ icon                 │
│ state                │         │ is_active            │
│ zip_code             │         │ created_at           │
│ country              │         │ updated_at           │
│ is_default           │         └──────────────────────┘
│ created_at           │                   │
│ updated_at           │                   │ 1:N
└──────────────────────┘                   ▼
                                 ┌──────────────────────┐
                                 │   PRODUCT_TYPES      │
┌──────────────────────┐         ├──────────────────────┤
│  PRINT_ZONE_CONFIGS  │◄────────│ id (PK)              │
├──────────────────────┤         │ category_id (FK)     │
│ id (PK)              │         │ name                 │
│ product_type_id (FK) │         │ slug                 │
│ zone_key             │         │ description          │
│ zone_name            │         │ icon                 │
│ side (front/back)    │         │ mockup_config        │ (JSON)
│ icon                 │         │ is_customizable      │
│ description          │         │ is_active            │
│ position_x           │         │ created_at           │
│ position_y           │         │ updated_at           │
│ width                │         └──────────────────────┘
│ height               │                   │
│ max_scale            │                   │ 1:N
│ created_at           │                   ▼
│ updated_at           │         ┌──────────────────────┐
└──────────────────────┘         │      PRODUCTS        │
                                 ├──────────────────────┤
                                 │ id (PK)              │
                                 │ product_type_id (FK) │
                                 │ sku (UNIQUE)         │
                                 │ name                 │
                                 │ slug                 │
                                 │ description          │
                                 │ price                │
                                 │ compare_at_price     │
                                 │ cost                 │
                                 │ stock                │
                                 │ low_stock_alert      │
                                 │ is_customizable      │
                                 │ is_featured          │
                                 │ is_active            │
                                 │ metadata             │ (JSON)
                                 │ created_at           │
                                 │ updated_at           │
                                 └──────────────────────┘
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    │                     │                      │
                    ▼                     ▼                      ▼
         ┌──────────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
         │  PRODUCT_IMAGES      │ │ PRODUCT_COLORS  │ │   PRODUCT_SIZES      │
         ├──────────────────────┤ ├─────────────────┤ ├──────────────────────┤
         │ id (PK)              │ │ id (PK)         │ │ id (PK)              │
         │ product_id (FK)      │ │ product_id (FK) │ │ product_id (FK)      │
         │ url                  │ │ color_name      │ │ size_name            │
         │ alt_text             │ │ color_hex       │ │ size_code            │
         │ side (front/back/etc)│ │ is_available    │ │ is_available         │
         │ order                │ │ created_at      │ │ created_at           │
         │ created_at           │ └─────────────────┘ └──────────────────────┘
         │ updated_at           │
         └──────────────────────┘


┌──────────────────────┐
│       USERS          │
└──────────────────────┘
         │ 1:N
         ▼
┌──────────────────────┐
│       CARTS          │
├──────────────────────┤
│ id (PK)              │
│ user_id (FK) NULL    │ (NULL = guest)
│ session_id           │
│ status               │ (active, abandoned, converted)
│ expires_at           │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │ 1:N
         ▼
┌──────────────────────┐
│     CART_ITEMS       │
├──────────────────────┤
│ id (PK)              │
│ cart_id (FK)         │
│ product_id (FK)      │
│ quantity             │
│ color                │
│ size                 │
│ unit_price           │
│ custom_design_id (FK)│ NULL
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │
         │ 1:1
         ▼
┌──────────────────────┐
│   CUSTOM_DESIGNS     │
├──────────────────────┤
│ id (PK)              │
│ product_type_id (FK) │
│ user_id (FK) NULL    │
│ name                 │
│ preview_url          │
│ design_data          │ (JSON: {front: {...}, back: {...}})
│ is_public            │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │ 1:N
         ▼
┌──────────────────────┐
│  DESIGN_ELEMENTS     │
├──────────────────────┤
│ id (PK)              │
│ custom_design_id (FK)│
│ zone_key             │
│ side (front/back)    │
│ image_url            │
│ scale                │
│ rotation             │
│ offset_x             │
│ offset_y             │
│ layer_order          │
│ created_at           │
│ updated_at           │
└──────────────────────┘


┌──────────────────────┐
│       ORDERS         │
├──────────────────────┤
│ id (PK)              │
│ user_id (FK)         │
│ order_number (UNIQUE)│
│ status               │ (pending, paid, in_production, shipped, delivered, cancelled)
│ subtotal             │
│ tax                  │
│ shipping_cost        │
│ discount             │
│ total                │
│ currency             │
│ payment_method       │
│ payment_status       │
│ payment_intent_id    │ (Stripe/MercadoPago)
│ shipping_address_id  │ (FK)
│ billing_address_id   │ (FK)
│ tracking_number      │
│ notes                │
│ metadata             │ (JSON)
│ paid_at              │
│ shipped_at           │
│ delivered_at         │
│ cancelled_at         │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │ 1:N
         ▼
┌──────────────────────┐
│     ORDER_ITEMS      │
├──────────────────────┤
│ id (PK)              │
│ order_id (FK)        │
│ product_id (FK)      │
│ custom_design_id (FK)│ NULL
│ quantity             │
│ color                │
│ size                 │
│ unit_price           │
│ subtotal             │
│ production_status    │ (pending, printing, ready)
│ production_file_url  │
│ created_at           │
│ updated_at           │
└──────────────────────┘


┌──────────────────────┐
│   ORDER_TIMELINE     │
├──────────────────────┤
│ id (PK)              │
│ order_id (FK)        │
│ status               │
│ message              │
│ created_by (FK)      │ (user_id)
│ created_at           │
└──────────────────────┘


┌──────────────────────┐
│    NOTIFICATIONS     │
├──────────────────────┤
│ id (PK)              │
│ user_id (FK)         │
│ type                 │ (order_update, promotion, system)
│ title                │
│ message              │
│ action_url           │
│ is_read              │
│ sent_at              │
│ read_at              │
│ created_at           │
└──────────────────────┘


┌──────────────────────┐
│   EMAIL_TEMPLATES    │
├──────────────────────┤
│ id (PK)              │
│ slug (UNIQUE)        │
│ name                 │
│ subject              │
│ html_body            │
│ text_body            │
│ variables            │ (JSON)
│ is_active            │
│ created_at           │
│ updated_at           │
└──────────────────────┘


┌──────────────────────┐
│    SITE_SETTINGS     │
├──────────────────────┤
│ id (PK)              │
│ key (UNIQUE)         │
│ value                │ (JSON)
│ type                 │ (string, number, boolean, json)
│ description          │
│ updated_at           │
└──────────────────────┘


┌──────────────────────┐
│    AUDIT_LOGS        │
├──────────────────────┤
│ id (PK)              │
│ user_id (FK) NULL    │
│ action               │
│ resource_type        │
│ resource_id          │
│ old_values           │ (JSON)
│ new_values           │ (JSON)
│ ip_address           │
│ user_agent           │
│ created_at           │
└──────────────────────┘
```

---

## DESCRIPCIÓN DE TABLAS

### 👤 MÓDULO DE USUARIOS Y AUTENTICACIÓN

#### **users**
Almacena información de todos los usuarios del sistema.
- `role_id`: Relación con tabla roles (SUPER_ADMIN, ADMIN, CLIENT)
- `email_verified`: Boolean para verificación de email
- `is_active`: Permite desactivar usuarios sin eliminarlos

#### **roles**
Define los roles del sistema.
- **SUPER_ADMIN**: Control total del sistema
- **ADMIN**: Gestión de productos y pedidos
- **CLIENT**: Acceso a compra y personalización

#### **permissions**
Define permisos granulares.
Ejemplos:
- `products:create`, `products:read`, `products:update`, `products:delete`
- `orders:read`, `orders:update`
- `users:manage`

#### **role_permissions**
Tabla pivote que relaciona roles con permisos.

#### **addresses**
Direcciones de envío/facturación de usuarios.
- `is_default`: Marca la dirección predeterminada
- `label`: "Casa", "Trabajo", etc.

---

### 📦 MÓDULO DE PRODUCTOS

#### **product_categories**
Categorías principales de productos.
Ejemplos: "Ropa", "Accesorios", "Hogar"

#### **product_types**
Tipos específicos de productos.
Ejemplos: "Camiseta", "Hoodie", "Gorra", "Taza"
- `mockup_config`: JSON con configuración para renderizar mockup en canvas
- `is_customizable`: Define si acepta diseños personalizados

#### **products**
Productos individuales del catálogo.
- `sku`: Stock Keeping Unit (código único)
- `compare_at_price`: Precio anterior (para mostrar descuento)
- `cost`: Costo de producción (privado, solo admin)
- `metadata`: JSON flexible para datos adicionales

#### **product_images**
Imágenes de productos.
- `side`: front, back, detail, lifestyle, etc.
- `order`: Orden de visualización

#### **product_colors**
Colores disponibles por producto.

#### **product_sizes**
Tallas disponibles por producto.

#### **print_zone_configs**
Configuración de zonas de estampado por tipo de producto.
Almacena posición, tamaño y restricciones de cada zona.

---

### 🎨 MÓDULO DE PERSONALIZACIÓN

#### **custom_designs**
Diseños personalizados creados por usuarios.
- `design_data`: JSON con toda la configuración del diseño
  ```json
  {
    "front": {
      "center-large": {...},
      "pocket-left": {...}
    },
    "back": {
      "center-large": {...}
    }
  }
  ```
- `preview_url`: URL de imagen de preview generada
- `is_public`: Si el diseño puede compartirse/verse públicamente

#### **design_elements**
Elementos individuales de un diseño (cada imagen/zona).
- `zone_key`: Referencia a print_zone_configs
- `image_url`: URL de la imagen cargada
- `layer_order`: Orden de capas (si se permite múltiples por zona)

---

### 🛒 MÓDULO DE CARRITO

#### **carts**
Carritos de compra (activos o abandonados).
- `user_id`: NULL para usuarios guest
- `session_id`: Identificador de sesión para guests
- `status`: active, abandoned, converted
- `expires_at`: Fecha de expiración (ej: 7 días)

#### **cart_items**
Items dentro de un carrito.
- `custom_design_id`: NULL si es producto sin personalizar

---

### 💳 MÓDULO DE ÓRDENES Y PAGOS

#### **orders**
Órdenes de compra confirmadas.
- `order_number`: Número único legible (ej: ORD-2025-001234)
- `status`: Flujo completo del pedido
- `payment_intent_id`: ID de transacción en Stripe/MercadoPago
- `shipping_address_id` / `billing_address_id`: Referencias a addresses

#### **order_items**
Productos dentro de una orden.
- `production_status`: Estado de producción individual del item
- `production_file_url`: Archivo listo para imprimir

#### **order_timeline**
Historial de cambios de estado de una orden.
Permite tracking detallado.

---

### 🔔 MÓDULO DE NOTIFICACIONES

#### **notifications**
Notificaciones push/in-app para usuarios.
- `type`: order_update, promotion, system
- `action_url`: URL a la que redirige al hacer clic

#### **email_templates**
Plantillas de emails del sistema.
- `slug`: identificador único (ej: "order_confirmation")
- `variables`: Variables disponibles para reemplazar

---

### ⚙️ MÓDULO DE CONFIGURACIÓN

#### **site_settings**
Configuración general del sitio.
Ejemplos:
```
key: "shipping_cost" → value: {"base": 5.00, "per_item": 2.00}
key: "tax_rate" → value: 0.16
key: "maintenance_mode" → value: false
```

#### **audit_logs**
Registro de todas las acciones importantes del sistema.
Para auditoría y debugging.

---

## ÍNDICES RECOMENDADOS

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);

-- Products
CREATE INDEX idx_products_product_type_id ON products(product_type_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Carts
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);
CREATE INDEX idx_carts_status ON carts(status);

-- Custom Designs
CREATE INDEX idx_custom_designs_user_id ON custom_designs(user_id);
CREATE INDEX idx_custom_designs_product_type_id ON custom_designs(product_type_id);
```

---

## DATOS INICIALES (SEEDS)

### Roles
```sql
INSERT INTO roles (name, description) VALUES
('SUPER_ADMIN', 'Control total del sistema'),
('ADMIN', 'Gestión de productos y pedidos'),
('CLIENT', 'Cliente final');
```

### Product Categories
```sql
INSERT INTO product_categories (name, slug, icon) VALUES
('Ropa', 'ropa', '👕'),
('Accesorios', 'accesorios', '🎒'),
('Hogar', 'hogar', '🏠');
```

### Product Types (Fase 1)
```sql
INSERT INTO product_types (category_id, name, slug, icon, is_customizable) VALUES
(1, 'Camiseta', 'camiseta', '👕', true),
(1, 'Hoodie', 'hoodie', '🧥', true),
(1, 'Sudadera', 'sudadera', '👔', true);
```

---

## RELACIONES CLAVE

```
users → carts (1:N)
users → orders (1:N)
users → addresses (1:N)
users → custom_designs (1:N)

product_categories → product_types (1:N)
product_types → products (1:N)
product_types → print_zone_configs (1:N)
product_types → custom_designs (1:N)

products → product_images (1:N)
products → product_colors (1:N)
products → product_sizes (1:N)
products → cart_items (1:N)
products → order_items (1:N)

carts → cart_items (1:N)
cart_items → custom_designs (N:1)

orders → order_items (1:N)
orders → order_timeline (1:N)

custom_designs → design_elements (1:N)

roles → users (1:N)
roles → role_permissions (1:N)
permissions → role_permissions (1:N)
```

---

**Última actualización:** 2025-11-22
**Versión:** 1.0

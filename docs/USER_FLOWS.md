# 🔄 Diagramas de Flujo de Usuario

## FLUJOS PRINCIPALES DEL SISTEMA

---

## 1. FLUJO DE NAVEGACIÓN GENERAL

```
[Usuario entra al sitio]
         │
         ▼
   [Página Principal]
         │
         ├──► [Ver Hero Section] ──► [Clic "Personaliza tu Prenda"] ──► [Ir a Personalizador]
         │
         ├──► [Scroll down] ──► [Ver Productos Destacados]
         │                              │
         │                              ├──► [Clic en Card] ──► [Detalle de Producto]
         │                              │
         │                              └──► [Clic "Ver Más"] ──► [Catálogo Completo]
         │
         └──► [Navegar a Catálogo desde menú] ──► [Catálogo Completo]
```

---

## 2. FLUJO DE COMPRA SIMPLE (Sin Personalización)

```
[Usuario en Catálogo]
         │
         ▼
[Navegar productos]
         │
         ├──► [Aplicar filtros] ──► [Ver resultados filtrados]
         │
         ├──► [Ordenar por precio/nombre] ──► [Ver productos ordenados]
         │
         └──► [Clic en producto] ──► [Detalle de Producto]
                                            │
                                            ▼
                                  [Ver información completa]
                                            │
                                            ├──► [Seleccionar color]
                                            │
                                            ├──► [Seleccionar talla]
                                            │
                                            ├──► [Ajustar cantidad]
                                            │
                                            ▼
                                  [Clic "Agregar al Carrito"]
                                            │
                                            ▼
                                  ┌─────────────────────┐
                                  │  ¿Stock disponible? │
                                  └─────────────────────┘
                                     │              │
                                    SÍ             NO
                                     │              │
                                     ▼              ▼
                          [Agregar al carrito]  [Mostrar error]
                          [Mostrar toast OK]    [Sugerir alternativa]
                                     │
                                     ▼
                          [Abrir drawer de carrito]
                                     │
                                     ├──► [Seguir comprando] ──► [Volver a catálogo]
                                     │
                                     └──► [Ver carrito] ──► [Página de carrito]
                                                                   │
                                                                   ▼
                                                         [Ver resumen completo]
                                                                   │
                                                                   ├──► [Editar cantidad]
                                                                   │
                                                                   ├──► [Eliminar item]
                                                                   │
                                                                   └──► [Clic "Proceder al Pago"]
                                                                              │
                                                                              ▼
                                                                   ┌────────────────────────┐
                                                                   │ FASE 1: Sin checkout   │
                                                                   │ Mostrar mensaje:       │
                                                                   │ "Próximamente"         │
                                                                   └────────────────────────┘
                                                                              │
                                                                              ▼
                                                                   ┌────────────────────────┐
                                                                   │ FASE 3: Checkout real  │
                                                                   │ Ver flujo #6           │
                                                                   └────────────────────────┘
```

---

## 3. FLUJO DE PERSONALIZACIÓN DE PRODUCTO

```
[Usuario quiere personalizar]
         │
         ├──► [Desde Home: Clic "Personaliza tu Prenda"]
         │
         ├──► [Desde Catálogo: Clic botón "Personalizar" en card]
         │
         └──► [Desde Detalle: Clic botón "Personalizar"]
                         │
                         ▼
              [Página de Personalizador]
                         │
                         ▼
         ┌───────────────────────────────┐
         │ PASO 1: Seleccionar Producto  │
         └───────────────────────────────┘
                         │
                         ▼
         [Ver lista de productos personalizables]
         [Camiseta, Hoodie, etc.]
                         │
                         ▼
         [Seleccionar tipo de producto]
                         │
                         ▼
         ┌───────────────────────────────┐
         │ PASO 2: Seleccionar Color     │
         └───────────────────────────────┘
                         │
                         ▼
         [Mostrar paleta de colores]
                         │
                         ▼
         [Seleccionar color] ──► [Canvas actualiza vista]
                         │
                         ▼
         ┌───────────────────────────────┐
         │ PASO 3: Personalizar Diseño   │
         └───────────────────────────────┘
                         │
                         ▼
         [Seleccionar vista: Frente/Espalda]
                         │
                         ▼
         [Ver zonas de estampado disponibles]
                         │
                         ▼
         [Seleccionar zona] ──► [Zona se marca en canvas]
                         │
                         ▼
         ┌─────────────────────────┐
         │ ¿Ya tiene diseño en     │
         │ esta zona?              │
         └─────────────────────────┘
            │              │
           SÍ             NO
            │              │
            ▼              ▼
    [Mostrar alerta] [Permitir subida]
    [¿Reemplazar?]         │
            │              │
            ├──► SÍ ───────┤
            │              │
            └──► NO ───► [Cancelar]
                         │
                         ▼
         [Clic "Subir Imagen"]
                         │
                         ▼
         [Abrir selector de archivos]
                         │
                         ▼
         ┌─────────────────────────┐
         │ ¿Imagen válida?         │
         │ (Tipo, tamaño)          │
         └─────────────────────────┘
            │              │
           SÍ             NO
            │              │
            ▼              ▼
    [Cargar imagen]   [Mostrar error]
    [Mostrar en canvas] [Sugerir corrección]
            │
            ▼
    [Imagen se coloca en zona]
    [Controles de ajuste aparecen]
            │
            ▼
    ┌───────────────────────────┐
    │ AJUSTAR DISEÑO:           │
    │ - Tamaño (slider)         │
    │ - Rotación (slider)       │
    │ - Posición X (slider)     │
    │ - Posición Y (slider)     │
    └───────────────────────────┘
            │
            ▼
    [Canvas actualiza en tiempo real]
            │
            ├──► [¿Quiere agregar más diseños?]
            │         │              │
            │        SÍ             NO
            │         │              │
            │         └─► [Volver a seleccionar zona]
            │                        │
            └────────────────────────┘
                         │
                         ▼
         [Cambiar a vista Espalda]
                         │
                         ▼
         [Repetir proceso de personalización]
                         │
                         ▼
         ┌───────────────────────────────┐
         │ PASO 4: Agregar al Carrito    │
         └───────────────────────────────┘
                         │
                         ▼
         ┌─────────────────────────┐
         │ ¿Tiene al menos 1       │
         │ diseño aplicado?        │
         └─────────────────────────┘
            │              │
           SÍ             NO
            │              │
            ▼              ▼
    [Habilitar botón]  [Deshabilitar botón]
    ["Agregar al       [Mostrar mensaje]
     Carrito"]
            │
            ▼
    [Clic "Agregar al Carrito"]
            │
            ▼
    [Guardar diseño personalizado]
    [Generar preview del diseño]
    [Agregar al carrito con diseño]
            │
            ▼
    [Mostrar toast de confirmación]
    [Abrir drawer de carrito]
            │
            ├──► [Seguir personalizando] ──► [Reiniciar proceso]
            │
            └──► [Ver carrito] ──► [Ir a página de carrito]
```

---

## 4. FLUJO DE GESTIÓN DEL CARRITO

```
[Usuario con items en carrito]
         │
         ▼
[Clic en icono de carrito en header]
         │
         ▼
[Se abre drawer lateral]
         │
         ▼
[Ver lista de items]
         │
         ├──► [Ver producto normal]
         │         │
         │         └──► [Imagen, nombre, color, talla, cantidad, precio]
         │
         └──► [Ver producto personalizado]
                   │
                   └──► [Preview del diseño, specs, precio]
                         │
                         ▼
         ┌─────────────────────────────┐
         │ ACCIONES POR ITEM:          │
         └─────────────────────────────┘
                         │
                         ├──► [Aumentar cantidad] ──► [Actualizar subtotal]
                         │
                         ├──► [Disminuir cantidad]
                         │         │
                         │         ▼
                         │    ┌────────────────┐
                         │    │ ¿Cantidad = 0? │
                         │    └────────────────┘
                         │         │       │
                         │        SÍ      NO
                         │         │       │
                         │         ▼       ▼
                         │    [Eliminar] [Actualizar]
                         │
                         └──► [Clic "Eliminar"]
                                   │
                                   ▼
                              [Confirmar eliminación]
                                   │
                                   ▼
                              [Remover del carrito]
                              [Actualizar total]
                                   │
                                   ▼
                              ┌────────────────┐
                              │ ¿Carrito vacío?│
                              └────────────────┘
                                   │       │
                                  SÍ      NO
                                   │       │
                                   ▼       ▼
                         [Mostrar mensaje] [Mostrar items]
                         ["Carrito vacío"]     │
                                   │           │
                                   └───────────┘
                                         │
                                         ▼
                         [Ver total calculado]
                                         │
                                         ├──► [Cerrar drawer] ──► [Volver a navegación]
                                         │
                                         └──► [Clic "Ver Carrito Completo"] ──► [Ir a /cart]
                                                                                      │
                                                                                      ▼
                                                                         [Página completa de carrito]
                                                                                      │
                                                                                      ▼
                                                                         [Ver detalles expandidos]
                                                                         [Editar items]
                                                                         [Ver resumen de costos]
                                                                                      │
                                                                                      └──► [Proceder al pago]
```

---

## 5. FLUJO DE ADMINISTRACIÓN (FASE 1)

```
[Usuario Admin]
         │
         ▼
[Navegar a footer]
         │
         ▼
[Clic en enlace oculto "Admin"]
         │
         ▼
[Ir a /admin-panel]
         │
         ▼
┌─────────────────────────┐
│ FASE 1: Sin login       │
│ Acceso directo          │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ FASE 2+: Con login      │
│ Ver flujo #7            │
└─────────────────────────┘
         │
         ▼
[Panel de Administración]
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌──────────────────────┐
│ GESTIÓN DE TIPOS    │          │ GESTIÓN DE PRODUCTOS │
│ DE PRODUCTO         │          └──────────────────────┘
└─────────────────────┘                     │
         │                                  │
         ▼                                  ▼
[Listar tipos]                    [Listar productos]
         │                                  │
         ├──► [Clic "Nuevo Tipo"]          ├──► [Clic "Nuevo Producto"]
         │         │                       │         │
         │         ▼                       │         ▼
         │    [Formulario]                 │    [Formulario completo]
         │         │                       │         │
         │         ├─► Nombre              │         ├─► Nombre
         │         ├─► Icono               │         ├─► Tipo (select)
         │         ├─► Categoría           │         ├─► Descripción
         │         └─► ¿Personalizable?    │         ├─► Precio
         │              │                  │         ├─► Colores (multi)
         │              ▼                  │         ├─► Tallas (multi)
         │         [Clic "Guardar"]        │         ├─► Imágenes
         │              │                  │         ├─► Stock
         │              ▼                  │         ├─► ¿Personalizable?
         │    ┌──────────────────┐         │         └─► Categoría
         │    │ ¿Datos válidos?  │         │              │
         │    └──────────────────┘         │              ▼
         │         │        │               │         [Clic "Guardar"]
         │        SÍ       NO               │              │
         │         │        │               │              ▼
         │         ▼        ▼               │    ┌──────────────────┐
         │    [Guardar] [Mostrar           │    │ ¿Datos válidos?  │
         │    [en JSON] errores]           │    └──────────────────┘
         │         │                       │         │        │
         │         ▼                       │        SÍ       NO
         │    [Actualizar lista]           │         │        │
         │                                 │         ▼        ▼
         ├──► [Clic "Editar"]             │    [Guardar] [Mostrar
         │         │                       │    [en JSON] errores]
         │         ▼                       │         │
         │    [Cargar datos]               │         ▼
         │    [Mostrar formulario]         │    [Actualizar lista]
         │         │                       │
         │         ▼                       ├──► [Clic "Editar"]
         │    [Modificar campos]           │         │
         │         │                       │         ▼
         │         ▼                       │    [Cargar datos]
         │    [Guardar cambios]            │    [Mostrar formulario]
         │                                 │         │
         └──► [Clic "Eliminar"]           │         ▼
                   │                       │    [Modificar campos]
                   ▼                       │         │
              [Confirmar]                  │         ▼
                   │                       │    [Guardar cambios]
                   ▼                       │
              [Eliminar de JSON]           └──► [Clic "Eliminar"]
              [Actualizar lista]                     │
                                                     ▼
                                                [Confirmar]
                                                     │
                                                     ▼
                                            ┌───────────────────┐
                                            │ ¿Tiene pedidos    │
                                            │ asociados?        │
                                            └───────────────────┘
                                                 │         │
                                                SÍ        NO
                                                 │         │
                                                 ▼         ▼
                                            [Mostrar   [Eliminar]
                                             error]    [Actualizar]


┌──────────────────────┐
│ VER CARRITOS         │
│ SIMULADOS            │
└──────────────────────┘
         │
         ▼
[Listar items en localStorage]
         │
         ▼
[Ver resumen de "pedidos pendientes"]
         │
         ├──► [Por usuario (session_id)]
         │
         ├──► [Total por carrito]
         │
         └──► [Eliminar carritos]
```

---

## 6. FLUJO DE CHECKOUT (FASE 3)

```
[Usuario en Carrito]
         │
         ▼
[Clic "Proceder al Pago"]
         │
         ▼
┌─────────────────────────┐
│ ¿Usuario autenticado?   │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         │         ▼
         │    [Mostrar opciones]
         │         │
         │         ├──► [Registrarse] ──► [Ver flujo #8]
         │         │
         │         └──► [Iniciar sesión] ──► [Ver flujo #8]
         │
         ▼
[Ir a Checkout]
         │
         ▼
┌───────────────────────────────┐
│ PASO 1: Información de Envío  │
└───────────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ ¿Tiene direcciones      │
│ guardadas?              │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
[Seleccionar] [Formulario nuevo]
[dirección]        │
         │         ├─► Nombre completo
         │         ├─► Teléfono
         │         ├─► Dirección
         │         ├─► Ciudad
         │         ├─► Estado
         │         ├─► Código Postal
         │         └─► País
         │              │
         │              ▼
         │         [Guardar dirección]
         │              │
         └──────────────┘
                   │
                   ▼
         [Continuar a Paso 2]
                   │
                   ▼
┌───────────────────────────────┐
│ PASO 2: Método de Envío       │
└───────────────────────────────┘
                   │
                   ▼
         [Ver opciones de envío]
         [Estándar, Express, etc.]
                   │
                   ▼
         [Seleccionar método]
         [Calcular costo]
                   │
                   ▼
         [Continuar a Paso 3]
                   │
                   ▼
┌───────────────────────────────┐
│ PASO 3: Método de Pago        │
└───────────────────────────────┘
                   │
                   ▼
         [Ver opciones de pago]
         [Tarjeta, PayPal, etc.]
                   │
                   ├──► [Tarjeta de crédito/débito]
                   │         │
                   │         ▼
                   │    [Formulario Stripe]
                   │         │
                   │         ├─► Número de tarjeta
                   │         ├─► Fecha expiración
                   │         ├─► CVV
                   │         └─► Nombre en tarjeta
                   │              │
                   │              ▼
                   │         [Validar con Stripe]
                   │
                   └──► [MercadoPago/Otro]
                             │
                             ▼
                        [Widget de pago]
                             │
                             └──────────────┐
                                            │
                                            ▼
┌───────────────────────────────┐
│ PASO 4: Resumen de Orden      │
└───────────────────────────────┘
                   │
                   ▼
         [Ver resumen completo]
         [Items, diseños, costos]
                   │
                   ▼
         [Subtotal]
         [Envío]
         [Impuestos]
         [Total]
                   │
                   ▼
         [Checkbox: Acepto términos]
                   │
                   ▼
         [Clic "Confirmar Pedido"]
                   │
                   ▼
         [Mostrar loading]
         [Procesar pago]
                   │
                   ▼
┌─────────────────────────┐
│ ¿Pago exitoso?          │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
    [Crear orden] [Mostrar error]
    [Generar número] [Sugerir reintentar]
    [Limpiar carrito]    │
         │               │
         ▼               ▼
    [Enviar email] [Volver a pago]
    [confirmación]
         │
         ▼
    [Redirigir a página]
    [de confirmación]
         │
         ▼
    [Mostrar detalles]
    [de la orden]
    [Número de tracking]
         │
         ├──► [Ver orden] ──► [Ir a mis pedidos]
         │
         └──► [Seguir comprando] ──► [Ir a catálogo]
```

---

## 7. FLUJO DE AUTENTICACIÓN (FASE 2+)

```
┌─────────────────────┐
│ REGISTRO            │
└─────────────────────┘
         │
         ▼
[Clic "Registrarse"]
         │
         ▼
[Formulario de registro]
         │
         ├─► Nombre
         ├─► Apellido
         ├─► Email
         ├─► Contraseña
         └─► Confirmar contraseña
              │
              ▼
         [Clic "Crear cuenta"]
              │
              ▼
┌─────────────────────────┐
│ ¿Email ya existe?       │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
    [Mostrar] [Crear usuario]
    [error]   [Rol: CLIENT]
         │         │
         │         ▼
         │    [Enviar email]
         │    [verificación]
         │         │
         │         ▼
         │    [Auto login]
         │    [Generar token JWT]
         │         │
         │         ▼
         │    [Redirigir a home]
         │         │
         └─────────┘


┌─────────────────────┐
│ LOGIN               │
└─────────────────────┘
         │
         ▼
[Clic "Iniciar sesión"]
         │
         ▼
[Formulario de login]
         │
         ├─► Email
         └─► Contraseña
              │
              ▼
         [Clic "Entrar"]
              │
              ▼
┌─────────────────────────┐
│ ¿Credenciales válidas?  │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
    [Generar]  [Mostrar error]
    [token JWT] [Contador intentos]
         │              │
         ▼              ▼
    [Guardar en] ┌──────────────┐
    [localStorage]│ ¿3 intentos? │
         │        └──────────────┘
         ▼              │     │
    [Cargar perfil]   SÍ    NO
         │              │     │
         ▼              ▼     ▼
    [Redirigir]    [Bloqueo] [Permitir]
    [según rol]    [temporal] [reintentar]
         │
         ├──► CLIENTE ──► [Home]
         │
         ├──► ADMIN ──► [Panel Admin]
         │
         └──► SUPER_ADMIN ──► [Panel Admin Avanzado]


┌─────────────────────┐
│ RECUPERAR CONTRASEÑA│
└─────────────────────┘
         │
         ▼
[Clic "Olvidé mi contraseña"]
         │
         ▼
[Formulario: Email]
         │
         ▼
[Clic "Enviar"]
         │
         ▼
┌─────────────────────────┐
│ ¿Email existe?          │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
    [Generar]  [Mostrar mensaje]
    [token]    [genérico por]
    [temporal] [seguridad]
         │         │
         ▼         │
    [Enviar email] │
    [con link]     │
         │         │
         └─────────┘
              │
              ▼
    [Usuario clic en link]
              │
              ▼
    [Validar token]
              │
              ▼
┌─────────────────────────┐
│ ¿Token válido y no      │
│ expirado?               │
└─────────────────────────┘
         │         │
        SÍ        NO
         │         │
         ▼         ▼
    [Formulario]  [Mostrar error]
    [nueva        [Link expirado]
     contraseña]       │
         │             ▼
         ├─► Nueva    [Solicitar nuevo]
         └─► Confirmar
              │
              ▼
         [Actualizar]
         [contraseña]
              │
              ▼
         [Auto login]
              │
              ▼
         [Redirigir]
```

---

## 8. FLUJO APP MÓVIL - FUNCIONES NATIVAS (FASE 4)

```
[Usuario abre App Móvil]
         │
         ▼
[React Native WebView]
[Carga sitio web]
         │
         ▼
[Web detecta: window.isNativeApp = true]
         │
         ▼
[Habilita funciones nativas en UI]
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌─────────────────────┐      ┌──────────────────────┐
│ SUBIR IMAGEN        │      │ NOTIFICACIONES PUSH  │
│ DESDE MÓVIL         │      └──────────────────────┘
└─────────────────────┘                 │
         │                              │
         ▼                              ▼
[Usuario en Personalizador]  [Backend envía notificación]
         │                              │
         ▼                              ▼
[Selecciona zona]            [Native recibe push]
         │                              │
         ▼                              ▼
[Clic "Subir Imagen"]        [Mostrar notificación]
         │                    [en pantalla]
         ▼                              │
┌─────────────────────┐                 │
│ ¿Origen de imagen?  │                 ▼
└─────────────────────┘        [Usuario hace tap]
         │         │                    │
    Galería    Cámara                   ▼
         │         │            [Abrir app en orden]
         ▼         ▼
    [Abrir]   [Abrir]
    [galería] [cámara]
         │         │
         │         ▼
         │    [Tomar foto]
         │         │
         └─────────┘
               │
               ▼
         [Seleccionar imagen]
               │
               ▼
    [Native lee imagen]
    [Convierte a base64]
               │
               ▼
    [postMessage a WebView]
    {
      type: 'IMAGE_UPLOADED',
      data: { base64: '...', zone: '...' }
    }
               │
               ▼
    [Web recibe mensaje]
               │
               ▼
    [Cargar imagen en canvas]
    [Aplicar a zona seleccionada]


┌─────────────────────┐
│ COMPARTIR DISEÑO    │
└─────────────────────┘
         │
         ▼
[Usuario termina diseño]
         │
         ▼
[Clic botón "Compartir"]
[Solo visible en app]
         │
         ▼
[Web genera imagen del diseño]
         │
         ▼
[postMessage a Native]
{
  type: 'SHARE_DESIGN',
  data: { imageUrl: '...', text: '...' }
}
         │
         ▼
[Native abre modal compartir]
         │
         ├──► [WhatsApp]
         ├──► [Facebook]
         ├──► [Instagram]
         ├──► [Guardar en galería]
         └──► [Copiar link]
```

---

## MENSAJES DE COMUNICACIÓN WEB ↔ NATIVE

### **De Web → Native:**

```typescript
// Subir imagen
{
  type: 'REQUEST_IMAGE',
  data: {
    zone: 'front-center',
    source: 'gallery' | 'camera'
  }
}

// Compartir diseño
{
  type: 'SHARE_DESIGN',
  data: {
    imageUrl: string,
    text: string,
    productName: string
  }
}

// Guardar en galería
{
  type: 'SAVE_TO_GALLERY',
  data: {
    imageUrl: string,
    filename: string
  }
}

// Solicitar permisos
{
  type: 'REQUEST_PERMISSIONS',
  data: {
    permission: 'camera' | 'photos' | 'notifications'
  }
}
```

### **De Native → Web:**

```typescript
// Imagen subida
{
  type: 'IMAGE_UPLOADED',
  data: {
    base64: string,
    zone: string,
    width: number,
    height: number
  }
}

// Permisos otorgados
{
  type: 'PERMISSIONS_GRANTED',
  data: {
    permission: string,
    granted: boolean
  }
}

// Notificación tocada
{
  type: 'NOTIFICATION_TAPPED',
  data: {
    orderId: string,
    type: 'order_update' | 'promotion'
  }
}

// Diseño compartido
{
  type: 'DESIGN_SHARED',
  data: {
    platform: 'whatsapp' | 'facebook' | 'instagram',
    success: boolean
  }
}
```

---

**Última actualización:** 2025-11-22
**Versión:** 1.0

import type { Design } from '../types/design';
import type { ProductType, PrintZoneConfig } from '../types/product';

// Constantes de configuración del canvas
const CANVAS_CONFIG = {
  BACKGROUND: {
    GRADIENT_START: '#f9fafb',
    GRADIENT_END: '#e5e7eb',
  },
  VIEW_TEXT: {
    COLOR: '#374151',
    FONT: 'bold 16px sans-serif',
    Y_POSITION: 30,
  },
  PRINT_ZONE: {
    FILL_COLOR: 'rgba(147, 51, 234, 0.08)',
    STROKE_COLOR: 'rgba(147, 51, 234, 0.5)',
    CORNER_COLOR: 'rgba(147, 51, 234, 0.8)',
    STROKE_WIDTH: 2,
    CORNER_SIZE: 15,
    DASH_PATTERN: [8, 4],
    TEXT_OFFSET: -25,
    TEXT_PADDING: 8,
    TEXT_BG_COLOR: 'rgba(255, 255, 255, 0.95)',
    TEXT_COLOR: 'rgba(147, 51, 234, 0.9)',
    TEXT_FONT: 'bold 13px sans-serif',
  },
} as const;

/**
 * Service para manejar el canvas de personalización de productos
 */
export class CanvasService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  /**
   * Inicializar el canvas
   */
  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }
  }

  /**
   * Limpiar el canvas
   */
  clear(): void {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Dibujar el producto base
   */
  drawProductBase(productType: ProductType, color: string, view: 'front' | 'back', selectedZone?: PrintZoneConfig, sizeScale: number = 1.0): void {
    if (!this.canvas || !this.ctx) return;

    this.clear();

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Dibujar fondo con gradiente
    this.drawBackground(ctx, width, height);

    // Guardar estado
    ctx.save();

    // Aplicar escala según la talla (escalar desde el centro)
    ctx.translate(width / 2, height / 2);
    ctx.scale(sizeScale, sizeScale);
    ctx.translate(-width / 2, -height / 2);

    // Determinar la vista según la zona seleccionada
    const perspectiveView = this.getPerspectiveView(view, selectedZone);

    // Dibujar silueta del producto según perspectiva
    switch (productType) {
      case 'tshirt':
        this.drawTShirt(ctx, width, height, color, perspectiveView);
        break;
      case 'hoodie':
        this.drawHoodie(ctx, width, height, color, view);
        break;
      case 'cap':
        this.drawCap(ctx, width, height, color, view);
        break;
      case 'bottle':
        this.drawBottle(ctx, width, height, color, view);
        break;
      case 'mug':
        this.drawMug(ctx, width, height, color, view);
        break;
      case 'pillow':
        this.drawPillow(ctx, width, height, color, view);
        break;
    }

    ctx.restore();

    // Agregar texto de vista según perspectiva
    this.drawViewLabel(ctx, width, perspectiveView);

    // Dibujar zona de impresión seleccionada
    if (selectedZone) {
      this.drawPrintZone(ctx, width, height, perspectiveView, selectedZone);
    }
  }

  /**
   * Dibujar camiseta realista con piezas separadas (cuerpo + mangas)
   */
  private drawTShirt(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, view: 'front' | 'back' | 'side'): void {
    const centerX = width / 2;
    const centerY = height / 2;

    if (view === 'side') {
      // ========== VISTA LATERAL ==========

      // PIEZA 1: Cuerpo principal (sin manga)
      ctx.beginPath();
      ctx.moveTo(centerX - 90, centerY - 170);
      ctx.quadraticCurveTo(centerX - 75, centerY - 175, centerX - 60, centerY - 165);
      ctx.lineTo(centerX - 55, centerY - 160);
      ctx.lineTo(centerX - 45, centerY - 162);
      ctx.quadraticCurveTo(centerX, centerY - 164, centerX + 40, centerY - 162);
      ctx.lineTo(centerX + 55, centerY - 5);
      ctx.lineTo(centerX + 55, centerY + 185);
      ctx.quadraticCurveTo(centerX + 52, centerY + 205, centerX + 35, centerY + 215);
      ctx.lineTo(centerX - 95, centerY + 215);
      ctx.quadraticCurveTo(centerX - 115, centerY + 210, centerX - 118, centerY + 185);
      ctx.lineTo(centerX - 118, centerY - 30);
      ctx.quadraticCurveTo(centerX - 115, centerY - 85, centerX - 105, centerY - 125);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // PIEZA 2: Manga lateral
      ctx.beginPath();
      ctx.moveTo(centerX + 40, centerY - 162);
      ctx.quadraticCurveTo(centerX + 60, centerY - 165, centerX + 110, centerY - 160);
      ctx.lineTo(centerX + 185, centerY - 145);
      ctx.quadraticCurveTo(centerX + 195, centerY - 135, centerX + 195, centerY - 80);
      ctx.lineTo(centerX + 195, centerY - 50);
      ctx.quadraticCurveTo(centerX + 190, centerY - 30, centerX + 170, centerY - 25);
      ctx.lineTo(centerX + 75, centerY - 22);
      ctx.quadraticCurveTo(centerX + 58, centerY - 18, centerX + 55, centerY - 5);
      ctx.lineTo(centerX + 40, centerY - 162);
      ctx.closePath();

      // Manga con color ligeramente más oscuro
      ctx.fillStyle = this.darkenColor(color, 5);
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (view === 'front') {
      // ========== VISTA FRONTAL ==========

      // PIEZA 1: Cuerpo principal (centro, sin mangas)
      ctx.beginPath();
      // Hombro izquierdo hasta donde inicia la manga
      ctx.moveTo(centerX - 135, centerY - 170);
      ctx.quadraticCurveTo(centerX - 120, centerY - 175, centerX - 55, centerY - 175);
      ctx.quadraticCurveTo(centerX - 35, centerY - 165, centerX - 28, centerY - 150);
      ctx.quadraticCurveTo(centerX - 18, centerY - 142, centerX, centerY - 138);
      ctx.quadraticCurveTo(centerX + 18, centerY - 142, centerX + 28, centerY - 150);
      ctx.quadraticCurveTo(centerX + 35, centerY - 165, centerX + 55, centerY - 175);
      ctx.quadraticCurveTo(centerX + 120, centerY - 175, centerX + 135, centerY - 170);
      // Costado derecho (línea de costura manga-cuerpo)
      ctx.lineTo(centerX + 135, centerY - 25);
      ctx.lineTo(centerX + 135, centerY + 185);
      ctx.quadraticCurveTo(centerX + 132, centerY + 205, centerX + 120, centerY + 215);
      // Base
      ctx.lineTo(centerX - 120, centerY + 215);
      // Costado izquierdo
      ctx.quadraticCurveTo(centerX - 132, centerY + 205, centerX - 135, centerY + 185);
      ctx.lineTo(centerX - 135, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // PIEZA 2: Manga derecha
      ctx.beginPath();
      ctx.moveTo(centerX + 135, centerY - 170);
      ctx.lineTo(centerX + 168, centerY - 145);
      ctx.quadraticCurveTo(centerX + 175, centerY - 130, centerX + 175, centerY - 80);
      ctx.lineTo(centerX + 175, centerY - 50);
      ctx.quadraticCurveTo(centerX + 172, centerY - 32, centerX + 138, centerY - 25);
      ctx.lineTo(centerX + 135, centerY - 25);
      ctx.lineTo(centerX + 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = this.darkenColor(color, 5);
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // PIEZA 3: Manga izquierda
      ctx.beginPath();
      ctx.moveTo(centerX - 135, centerY - 170);
      ctx.lineTo(centerX - 168, centerY - 145);
      ctx.quadraticCurveTo(centerX - 175, centerY - 130, centerX - 175, centerY - 80);
      ctx.lineTo(centerX - 175, centerY - 50);
      ctx.quadraticCurveTo(centerX - 172, centerY - 32, centerX - 138, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = this.darkenColor(color, 5);
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else {
      // ========== VISTA TRASERA ==========

      // PIEZA 1: Cuerpo principal (centro, sin mangas)
      ctx.beginPath();
      ctx.moveTo(centerX - 135, centerY - 170);
      ctx.quadraticCurveTo(centerX - 120, centerY - 175, centerX - 45, centerY - 175);
      // Cuello en U en la espalda (más natural)
      ctx.quadraticCurveTo(centerX - 30, centerY - 168, centerX - 20, centerY - 160);
      ctx.quadraticCurveTo(centerX - 10, centerY - 152, centerX, centerY - 150);
      ctx.quadraticCurveTo(centerX + 10, centerY - 152, centerX + 20, centerY - 160);
      ctx.quadraticCurveTo(centerX + 30, centerY - 168, centerX + 45, centerY - 175);
      ctx.quadraticCurveTo(centerX + 120, centerY - 175, centerX + 135, centerY - 170);
      // Costado derecho (línea de costura manga-cuerpo)
      ctx.lineTo(centerX + 135, centerY - 25);
      ctx.lineTo(centerX + 135, centerY + 185);
      ctx.quadraticCurveTo(centerX + 132, centerY + 205, centerX + 120, centerY + 215);
      // Base
      ctx.lineTo(centerX - 120, centerY + 215);
      // Costado izquierdo
      ctx.quadraticCurveTo(centerX - 132, centerY + 205, centerX - 135, centerY + 185);
      ctx.lineTo(centerX - 135, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // PIEZA 2: Manga derecha
      ctx.beginPath();
      ctx.moveTo(centerX + 135, centerY - 170);
      ctx.lineTo(centerX + 168, centerY - 145);
      ctx.quadraticCurveTo(centerX + 175, centerY - 130, centerX + 175, centerY - 80);
      ctx.lineTo(centerX + 175, centerY - 50);
      ctx.quadraticCurveTo(centerX + 172, centerY - 32, centerX + 138, centerY - 25);
      ctx.lineTo(centerX + 135, centerY - 25);
      ctx.lineTo(centerX + 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = this.darkenColor(color, 5);
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // PIEZA 3: Manga izquierda
      ctx.beginPath();
      ctx.moveTo(centerX - 135, centerY - 170);
      ctx.lineTo(centerX - 168, centerY - 145);
      ctx.quadraticCurveTo(centerX - 175, centerY - 130, centerX - 175, centerY - 80);
      ctx.lineTo(centerX - 175, centerY - 50);
      ctx.quadraticCurveTo(centerX - 172, centerY - 32, centerX - 138, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 25);
      ctx.lineTo(centerX - 135, centerY - 170);
      ctx.closePath();

      ctx.fillStyle = this.darkenColor(color, 5);
      ctx.fill();
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Costuras realistas - ahora marcan las uniones entre las piezas separadas
    if (view === 'front' || view === 'back') {
      // ========== COSTURA DE MANGAS (Unión manga-cuerpo) ==========
      // Costura principal que une las mangas al cuerpo
      ctx.strokeStyle = this.darkenColor(color, 20);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);

      // Costura derecha - sigue la línea de unión entre el cuerpo y la manga
      ctx.beginPath();
      ctx.moveTo(centerX + 135, centerY - 170);
      ctx.lineTo(centerX + 135, centerY - 25);
      ctx.stroke();

      // Costura izquierda
      ctx.beginPath();
      ctx.moveTo(centerX - 135, centerY - 170);
      ctx.lineTo(centerX - 135, centerY - 25);
      ctx.stroke();

      // Línea interna de refuerzo
      ctx.strokeStyle = this.darkenColor(color, 12);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 2]);

      ctx.beginPath();
      ctx.moveTo(centerX + 137, centerY - 168);
      ctx.lineTo(centerX + 137, centerY - 27);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - 137, centerY - 168);
      ctx.lineTo(centerX - 137, centerY - 27);
      ctx.stroke();

      ctx.setLineDash([]);

      // ========== COSTURA DEL CUELLO ==========
      if (view === 'front') {
        ctx.strokeStyle = this.darkenColor(color, 20);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 2]);

        // Cuello frontal en V
        ctx.beginPath();
        ctx.moveTo(centerX - 55, centerY - 175);
        ctx.quadraticCurveTo(centerX - 35, centerY - 165, centerX - 28, centerY - 150);
        ctx.quadraticCurveTo(centerX - 18, centerY - 142, centerX, centerY - 138);
        ctx.quadraticCurveTo(centerX + 18, centerY - 142, centerX + 28, centerY - 150);
        ctx.quadraticCurveTo(centerX + 35, centerY - 165, centerX + 55, centerY - 175);
        ctx.stroke();

        ctx.setLineDash([]);
      } else {
        // Cuello trasero en U
        ctx.strokeStyle = this.darkenColor(color, 20);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 2]);

        ctx.beginPath();
        ctx.moveTo(centerX - 45, centerY - 175);
        ctx.quadraticCurveTo(centerX - 30, centerY - 168, centerX - 20, centerY - 160);
        ctx.quadraticCurveTo(centerX - 10, centerY - 152, centerX, centerY - 150);
        ctx.quadraticCurveTo(centerX + 10, centerY - 152, centerX + 20, centerY - 160);
        ctx.quadraticCurveTo(centerX + 30, centerY - 168, centerX + 45, centerY - 175);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      // ========== DOBLADILLO INFERIOR ==========
      ctx.strokeStyle = this.darkenColor(color, 18);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 3]);

      ctx.beginPath();
      ctx.moveTo(centerX - 120, centerY + 213);
      ctx.lineTo(centerX + 120, centerY + 213);
      ctx.stroke();

      // Línea de refuerzo del dobladillo
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeStyle = this.darkenColor(color, 12);

      ctx.beginPath();
      ctx.moveTo(centerX - 120, centerY + 210);
      ctx.lineTo(centerX + 120, centerY + 210);
      ctx.stroke();

      ctx.setLineDash([]);

      // ========== COSTURAS INTERNAS DE LAS MANGAS ==========
      // Estas costuras van dentro de cada manga
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);

      // Manga derecha - costura interna
      ctx.beginPath();
      ctx.moveTo(centerX + 138, centerY - 25);
      ctx.quadraticCurveTo(centerX + 145, centerY - 28, centerX + 155, centerY - 35);
      ctx.quadraticCurveTo(centerX + 165, centerY - 45, centerX + 172, centerY - 65);
      ctx.lineTo(centerX + 174, centerY - 100);
      ctx.stroke();

      // Manga izquierda - costura interna
      ctx.beginPath();
      ctx.moveTo(centerX - 138, centerY - 25);
      ctx.quadraticCurveTo(centerX - 145, centerY - 28, centerX - 155, centerY - 35);
      ctx.quadraticCurveTo(centerX - 165, centerY - 45, centerX - 172, centerY - 65);
      ctx.lineTo(centerX - 174, centerY - 100);
      ctx.stroke();

      ctx.setLineDash([]);

    } else if (view === 'side') {
      // ========== COSTURAS VISTA LATERAL ==========

      // Costura de unión manga-cuerpo (la más importante en esta vista)
      ctx.strokeStyle = this.darkenColor(color, 20);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);

      ctx.beginPath();
      ctx.moveTo(centerX + 40, centerY - 162);
      ctx.lineTo(centerX + 55, centerY - 5);
      ctx.stroke();

      ctx.setLineDash([]);

      // Costura del hombro
      ctx.strokeStyle = this.darkenColor(color, 18);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 2]);

      ctx.beginPath();
      ctx.moveTo(centerX - 45, centerY - 162);
      ctx.quadraticCurveTo(centerX, centerY - 164, centerX + 40, centerY - 162);
      ctx.stroke();

      // Costura inferior de la manga
      ctx.beginPath();
      ctx.moveTo(centerX + 55, centerY - 5);
      ctx.quadraticCurveTo(centerX + 58, centerY - 12, centerX + 65, centerY - 18);
      ctx.lineTo(centerX + 160, centerY - 24);
      ctx.stroke();

      // Dobladillo inferior
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 3]);

      ctx.beginPath();
      ctx.moveTo(centerX - 95, centerY + 213);
      ctx.lineTo(centerX + 35, centerY + 213);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }

  /**
   * Dibujar hoodie mejorado
   */
  private drawHoodie(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, view: 'front' | 'back'): void {
    const centerX = width / 2;
    const centerY = height / 2 + 20;

    // Crear gradiente
    const gradient = ctx.createLinearGradient(centerX - 150, 0, centerX + 150, 0);
    gradient.addColorStop(0, this.darkenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 20));

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Capucha
    ctx.arc(centerX, centerY - 120, 60, Math.PI, 0, false);

    // Hombro y manga derecha
    ctx.lineTo(centerX + 60, centerY - 120);
    ctx.quadraticCurveTo(centerX + 130, centerY - 120, centerX + 150, centerY - 90);
    ctx.lineTo(centerX + 150, centerY - 50);
    ctx.quadraticCurveTo(centerX + 140, centerY - 40, centerX + 120, centerY - 40);

    // Lado derecho
    ctx.lineTo(centerX + 120, centerY + 130);
    ctx.quadraticCurveTo(centerX + 120, centerY + 150, centerX + 110, centerY + 160);

    // Parte inferior
    ctx.lineTo(centerX - 110, centerY + 160);
    ctx.quadraticCurveTo(centerX - 120, centerY + 150, centerX - 120, centerY + 130);

    // Lado izquierdo
    ctx.lineTo(centerX - 120, centerY - 40);
    ctx.quadraticCurveTo(centerX - 140, centerY - 40, centerX - 150, centerY - 50);

    // Manga izquierda
    ctx.lineTo(centerX - 150, centerY - 90);
    ctx.quadraticCurveTo(centerX - 130, centerY - 120, centerX - 60, centerY - 120);

    ctx.closePath();
    ctx.fill();

    // Sombras
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Detalles del hoodie
    if (view === 'front') {
      // Cordones de la capucha
      ctx.strokeStyle = this.darkenColor(color, 40);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 30, centerY - 100);
      ctx.lineTo(centerX - 20, centerY - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX + 30, centerY - 100);
      ctx.lineTo(centerX + 20, centerY - 20);
      ctx.stroke();

      // Bolsillo canguro
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 70, centerY + 20);
      ctx.quadraticCurveTo(centerX, centerY + 30, centerX + 70, centerY + 20);
      ctx.stroke();
    }
  }

  /**
   * Dibujar gorra
   */
  private drawCap(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, _view: 'front' | 'back'): void {
    const centerX = width / 2;
    const centerY = height / 2;

    const gradient = ctx.createRadialGradient(centerX, centerY - 20, 20, centerX, centerY - 20, 100);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, this.darkenColor(color, 25));

    ctx.fillStyle = gradient;

    // Parte superior de la gorra
    ctx.beginPath();
    ctx.arc(centerX, centerY - 20, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Visera
    ctx.fillStyle = this.darkenColor(color, 30);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 50, 130, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.stroke();
  }

  /**
   * Dibujar botella
   */
  private drawBottle(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, _view: 'front' | 'back'): void {
    const centerX = width / 2;
    const centerY = height / 2;

    const gradient = ctx.createLinearGradient(centerX - 60, 0, centerX + 60, 0);
    gradient.addColorStop(0, this.darkenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 20));

    // Tapa
    ctx.fillStyle = this.darkenColor(color, 40);
    ctx.beginPath();
    ctx.roundRect(centerX - 25, centerY - 160, 50, 25, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cuello
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(centerX - 30, centerY - 135, 60, 40, 5);
    ctx.fill();

    // Cuerpo principal
    ctx.beginPath();
    ctx.roundRect(centerX - 60, centerY - 95, 120, 230, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Dibujar taza
   */
  private drawMug(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, view: 'front' | 'back'): void {
    const centerX = width / 2;
    const centerY = height / 2;

    const gradient = ctx.createLinearGradient(centerX - 80, 0, centerX + 80, 0);
    gradient.addColorStop(0, this.darkenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 20));

    // Cuerpo de la taza
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(centerX - 80, centerY - 70, 160, 140, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Asa (solo vista frontal o lateral)
    if (view === 'front') {
      ctx.beginPath();
      ctx.arc(centerX + 100, centerY, 40, Math.PI * 0.3, Math.PI * 1.7, false);
      ctx.lineWidth = 18;
      ctx.strokeStyle = this.darkenColor(color, 15);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.stroke();
    }
  }

  /**
   * Dibujar almohada
   */
  private drawPillow(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, _view: 'front' | 'back'): void {
    const centerX = width / 2;
    const centerY = height / 2;

    const gradient = ctx.createLinearGradient(centerX - 140, centerY - 140, centerX + 140, centerY + 140);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this.lightenColor(color, 10));
    gradient.addColorStop(1, this.darkenColor(color, 15));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(centerX - 140, centerY - 100, 280, 200, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Costuras decorativas
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(centerX - 130, centerY - 90, 260, 180);
    ctx.setLineDash([]);
  }

  /**
   * Dibujar un diseño en el canvas
   */
  async drawDesign(design: Design): Promise<void> {
    if (!this.ctx) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = design.imageUrl || design.imageData || '';
      });

      const ctx = this.ctx;
      ctx.save();

      // Aplicar transformaciones
      ctx.globalAlpha = design.opacity;
      ctx.translate(design.position.x + design.size.width / 2, design.position.y + design.size.height / 2);
      ctx.rotate((design.rotation * Math.PI) / 180);
      ctx.translate(-(design.position.x + design.size.width / 2), -(design.position.y + design.size.height / 2));

      // Aplicar filtros si existen
      if (design.filters) {
        if (design.filters.brightness !== undefined) {
          ctx.filter = `brightness(${design.filters.brightness}%)`;
        }
        if (design.filters.grayscale) {
          ctx.filter += ' grayscale(100%)';
        }
      }

      // Dibujar imagen
      ctx.drawImage(img, design.position.x, design.position.y, design.size.width, design.size.height);

      ctx.restore();
    } catch (error) {
      console.error('Error dibujando diseño:', error);
    }
  }

  /**
   * Exportar canvas como imagen
   */
  exportAsImage(format: 'png' | 'jpeg' = 'png', quality = 0.95): string | null {
    if (!this.canvas) return null;
    return this.canvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * Redimensionar canvas
   */
  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Dibujar zona de impresión seleccionada (guía visual)
   */
  private drawPrintZone(ctx: CanvasRenderingContext2D, _width: number, _height: number, _view: 'front' | 'back' | 'side', zone: PrintZoneConfig): void {
    ctx.save();

    const { x: zoneX, y: zoneY } = zone.position;
    const zoneWidth = zone.maxWidth;
    const zoneHeight = zone.maxHeight;

    // Fondo semi-transparente
    ctx.fillStyle = CANVAS_CONFIG.PRINT_ZONE.FILL_COLOR;
    ctx.fillRect(zoneX, zoneY, zoneWidth, zoneHeight);

    // Borde punteado
    ctx.strokeStyle = CANVAS_CONFIG.PRINT_ZONE.STROKE_COLOR;
    ctx.lineWidth = CANVAS_CONFIG.PRINT_ZONE.STROKE_WIDTH;
    ctx.setLineDash(CANVAS_CONFIG.PRINT_ZONE.DASH_PATTERN);
    ctx.strokeRect(zoneX, zoneY, zoneWidth, zoneHeight);
    ctx.setLineDash([]);

    // Esquinas decorativas
    const cornerSize = CANVAS_CONFIG.PRINT_ZONE.CORNER_SIZE;
    ctx.strokeStyle = CANVAS_CONFIG.PRINT_ZONE.CORNER_COLOR;
    ctx.lineWidth = 3;

    // Esquina superior izquierda
    ctx.beginPath();
    ctx.moveTo(zoneX, zoneY + cornerSize);
    ctx.lineTo(zoneX, zoneY);
    ctx.lineTo(zoneX + cornerSize, zoneY);
    ctx.stroke();

    // Esquina superior derecha
    ctx.beginPath();
    ctx.moveTo(zoneX + zoneWidth - cornerSize, zoneY);
    ctx.lineTo(zoneX + zoneWidth, zoneY);
    ctx.lineTo(zoneX + zoneWidth, zoneY + cornerSize);
    ctx.stroke();

    // Esquina inferior izquierda
    ctx.beginPath();
    ctx.moveTo(zoneX, zoneY + zoneHeight - cornerSize);
    ctx.lineTo(zoneX, zoneY + zoneHeight);
    ctx.lineTo(zoneX + cornerSize, zoneY + zoneHeight);
    ctx.stroke();

    // Esquina inferior derecha
    ctx.beginPath();
    ctx.moveTo(zoneX + zoneWidth - cornerSize, zoneY + zoneHeight);
    ctx.lineTo(zoneX + zoneWidth, zoneY + zoneHeight);
    ctx.lineTo(zoneX + zoneWidth, zoneY + zoneHeight - cornerSize);
    ctx.stroke();

    // Dibujar etiqueta de la zona
    this.drawZoneLabel(ctx, zone.name, zoneX, zoneY, zoneWidth);

    ctx.restore();
  }

  /**
   * Dibujar etiqueta de nombre de zona
   */
  private drawZoneLabel(ctx: CanvasRenderingContext2D, zoneName: string, zoneX: number, zoneY: number, zoneWidth: number): void {
    ctx.fillStyle = CANVAS_CONFIG.PRINT_ZONE.TEXT_COLOR;
    ctx.font = CANVAS_CONFIG.PRINT_ZONE.TEXT_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textX = zoneX + zoneWidth / 2;
    const textY = zoneY + CANVAS_CONFIG.PRINT_ZONE.TEXT_OFFSET;
    const textMetrics = ctx.measureText(zoneName);
    const padding = CANVAS_CONFIG.PRINT_ZONE.TEXT_PADDING;

    // Fondo para el texto
    ctx.fillStyle = CANVAS_CONFIG.PRINT_ZONE.TEXT_BG_COLOR;
    ctx.fillRect(
      textX - textMetrics.width / 2 - padding,
      textY - padding,
      textMetrics.width + padding * 2,
      20
    );

    // Texto
    ctx.fillStyle = CANVAS_CONFIG.PRINT_ZONE.TEXT_COLOR;
    ctx.fillText(zoneName, textX, textY);
  }

  /**
   * Dibujar fondo del canvas
   */
  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, CANVAS_CONFIG.BACKGROUND.GRADIENT_START);
    gradient.addColorStop(1, CANVAS_CONFIG.BACKGROUND.GRADIENT_END);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Obtener la vista en perspectiva según la zona seleccionada
   */
  private getPerspectiveView(
    view: 'front' | 'back',
    selectedZone?: PrintZoneConfig
  ): 'front' | 'back' | 'side' {
    if (!selectedZone) return view;

    if (selectedZone.id.includes('sleeve')) return 'side';
    if (selectedZone.id.includes('back')) return 'back';
    return 'front';
  }

  /**
   * Dibujar etiqueta de vista
   */
  private drawViewLabel(ctx: CanvasRenderingContext2D, width: number, view: 'front' | 'back' | 'side'): void {
    ctx.fillStyle = CANVAS_CONFIG.VIEW_TEXT.COLOR;
    ctx.font = CANVAS_CONFIG.VIEW_TEXT.FONT;
    ctx.textAlign = 'center';

    const viewText = view === 'side'
      ? '👕 Vista Lateral'
      : view === 'back'
        ? '👕 Vista Trasera'
        : '👕 Vista Frontal';

    ctx.fillText(viewText, width / 2, CANVAS_CONFIG.VIEW_TEXT.Y_POSITION);
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * Aclarar un color
   */
  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min((num >> 16) + amt, 255);
    const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
    const B = Math.min((num & 0x0000FF) + amt, 255);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
}

// Instancia singleton
export const canvasService = new CanvasService();

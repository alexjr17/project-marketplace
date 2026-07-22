<?php

namespace Database\Seeders;

use App\Models\MfgCollection;
use App\Models\MfgColor;
use App\Models\MfgGarmentType;
use App\Models\MfgInput;
use App\Models\MfgInputType;
use App\Models\MfgProcess;
use App\Models\MfgProductionOrder;
use App\Models\MfgReference;
use App\Models\MfgSize;
use App\Models\MfgWarehouse;
use App\Models\MfgWorkshop;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Datos de ejemplo para la app Fábrica (catálogos + referencias + una orden).
 * Idempotente: usa firstOrCreate por clave única, así se puede re-ejecutar.
 *   php artisan db:seed --class=ManufacturingSeeder
 */
class ManufacturingSeeder extends Seeder
{
    public function run(): void
    {
        // ---------- Colecciones ----------
        $col1 = MfgCollection::firstOrCreate(['name' => '2026-I'], ['year' => 2026, 'semester' => 'I']);
        MfgCollection::firstOrCreate(['name' => '2026-II'], ['year' => 2026, 'semester' => 'II']);

        // ---------- Tipos de prenda (con composición) ----------
        $cam = MfgGarmentType::updateOrCreate(['code' => 'CAM'], ['name' => 'Camiseta', 'composition' => 'SUPERIOR']);
        $hoo = MfgGarmentType::updateOrCreate(['code' => 'HOO'], ['name' => 'Hoodie', 'composition' => 'SUPERIOR']);
        $pan = MfgGarmentType::updateOrCreate(['code' => 'PAN'], ['name' => 'Pantalón', 'composition' => 'INFERIOR']);
        $buz = MfgGarmentType::updateOrCreate(['code' => 'BUZ'], ['name' => 'Buzo', 'composition' => 'SUPERIOR']);
        $cjt = MfgGarmentType::updateOrCreate(['code' => 'CJT'], ['name' => 'Conjunto Deportivo', 'composition' => 'SET']);

        // ---------- Colores ----------
        $colors = [];
        foreach ([
            ['Blanco', '#FFFFFF', '00'],
            ['Negro', '#111827', '01'],
            ['Azul Marino', '#1E3A5F', '02'],
            ['Rojo', '#E11D48', '03'],
            ['Verde', '#16A34A', '04'],
            ['Gris', '#6B7280', '05'],
        ] as [$n, $hex, $c]) {
            $colors[$n] = MfgColor::firstOrCreate(['name' => $n], ['hexCode' => $hex, 'code' => $c]);
        }

        // ---------- Tallas (alfabéticas = Nacional, numéricas = Exportación) ----------
        $sizes = [];
        foreach ([['XS', 0], ['S', 1], ['M', 2], ['L', 3], ['XL', 4]] as [$ab, $ord]) {
            $sizes[$ab] = MfgSize::updateOrCreate(['abbreviation' => $ab], ['name' => $ab, 'sortOrder' => $ord, 'market' => 'NATIONAL']);
        }
        foreach ([['6', 10], ['8', 11], ['10', 12], ['12', 13], ['14', 14], ['16', 15]] as [$ab, $ord]) {
            $sizes[$ab] = MfgSize::updateOrCreate(['abbreviation' => $ab], ['name' => 'Talla '.$ab, 'sortOrder' => $ord, 'market' => 'EXPORT']);
        }

        // ---------- Tallas por tipo de prenda (nacional alfabético / exportación numérico) ----------
        $sid = fn (string $ab) => $sizes[$ab]->id;
        $natAll = [$sid('S'), $sid('M'), $sid('L'), $sid('XL')];
        $natMLX = [$sid('M'), $sid('L'), $sid('XL')];
        $natSML = [$sid('S'), $sid('M'), $sid('L')];
        $exp4 = [$sid('8'), $sid('10'), $sid('12'), $sid('14')];
        $exp5 = [$sid('8'), $sid('10'), $sid('12'), $sid('14'), $sid('16')];
        $exp3 = [$sid('6'), $sid('8'), $sid('10')];
        $this->syncTypeSizes($cam->id, $natAll, $exp4);
        $this->syncTypeSizes($hoo->id, $natMLX, [$sid('10'), $sid('12'), $sid('14')]);
        $this->syncTypeSizes($pan->id, $natAll, $exp5);
        $this->syncTypeSizes($buz->id, $natMLX, [$sid('10'), $sid('12'), $sid('14')]);
        $this->syncTypeSizes($cjt->id, $natSML, $exp3);

        // ---------- Tipos de insumo (Producto / Servicio; Telas = por color) ----------
        $tTela = MfgInputType::updateOrCreate(['name' => 'Telas'], ['classification' => 'PRODUCTO', 'consumesByColor' => true]);
        $tHilo = MfgInputType::updateOrCreate(['name' => 'Hilos'], ['classification' => 'PRODUCTO', 'consumesByColor' => false]);
        $tBoton = MfgInputType::updateOrCreate(['name' => 'Botones y cierres'], ['classification' => 'PRODUCTO', 'consumesByColor' => false]);
        $tEtiq = MfgInputType::updateOrCreate(['name' => 'Etiquetas'], ['classification' => 'PRODUCTO', 'consumesByColor' => false]);
        $tServ = MfgInputType::updateOrCreate(['name' => 'Servicios'], ['classification' => 'SERVICIO', 'consumesByColor' => false]);

        // ---------- Insumos (materiales + servicios; varias telas para sustituir) ----------
        $inputs = [];
        foreach ([
            ['TEL-01', 'Tela algodón', 'm', $tTela->id, null],
            ['TEL-02', 'Tela algodón premium', 'm', $tTela->id, null],
            ['TEL-03', 'Tela jersey', 'm', $tTela->id, null],
            ['HIL-01', 'Hilo', 'cono', $tHilo->id, null],
            ['BOT-01', 'Botón', 'und', $tBoton->id, null],
            ['CRE-01', 'Cremallera', 'und', $tBoton->id, null],
            ['ETI-01', 'Etiqueta', 'und', $tEtiq->id, null],
            ['SRV-01', 'Bordado', 'und', $tServ->id, 'EXTERNAL'],
            ['SRV-02', 'Confección', 'und', $tServ->id, 'INTERNAL'],
        ] as [$code, $n, $um, $tid, $scope]) {
            $inputs[$code] = MfgInput::updateOrCreate(['code' => $code], ['name' => $n, 'unitOfMeasure' => $um, 'inputTypeId' => $tid, 'scope' => $scope]);
        }

        // ---------- Procesos (ruta por defecto) ----------
        $procs = [];
        foreach ([
            ['Corte', 'CRT', 1, 'INTERNAL'],
            ['Confección', 'CNF', 2, 'INTERNAL'],
            ['Estampado', 'EST', 3, 'EXTERNAL'],
            ['Terminado', 'TER', 4, 'INTERNAL'],
            ['Empaque', 'EMP', 5, 'INTERNAL'],
        ] as [$n, $code, $seq, $type]) {
            $procs[$code] = MfgProcess::firstOrCreate(['code' => $code], ['name' => $n, 'sequence' => $seq, 'type' => $type]);
        }

        // ---------- Talleres (asociados a los procesos que hacen) ----------
        $wInt = MfgWorkshop::firstOrCreate(['name' => 'Taller Interno'], ['type' => 'INTERNAL']);
        $wSol = MfgWorkshop::firstOrCreate(['name' => 'Confecciones El Sol'], ['type' => 'EXTERNAL', 'phone' => '3001234567', 'contactName' => 'María']);
        $wJR = MfgWorkshop::firstOrCreate(['name' => 'Estampados JR'], ['type' => 'EXTERNAL', 'phone' => '3009876543', 'contactName' => 'Jorge']);
        $wInt->processes()->sync([$procs['CRT']->id, $procs['CNF']->id, $procs['TER']->id, $procs['EMP']->id]);
        $wSol->processes()->sync([$procs['CNF']->id, $procs['TER']->id]);
        $wJR->processes()->sync([$procs['EST']->id]);

        // ---------- Consumo configurado por proceso (por tipo o insumo) ----------
        foreach ($procs as $p) {
            $p->consumptions()->delete();
        }
        $procs['CRT']->consumptions()->create(['kind' => 'TYPE', 'inputTypeId' => $tTela->id]);   // Corte consume Telas
        $procs['CNF']->consumptions()->create(['kind' => 'TYPE', 'inputTypeId' => $tHilo->id]);   // Confección consume Hilos
        $procs['CNF']->consumptions()->create(['kind' => 'INPUT', 'inputId' => $inputs['SRV-02']->id]); // + servicio Confección
        $procs['EST']->consumptions()->create(['kind' => 'INPUT', 'inputId' => $inputs['SRV-01']->id]); // Estampado consume Bordado

        // ---------- Bodegas ----------
        $bodPT = MfgWarehouse::firstOrCreate(['code' => 'BOD-01'], ['name' => 'Bodega Principal']);
        MfgWarehouse::firstOrCreate(['code' => 'BOD-02'], ['name' => 'Producto Terminado']);

        // ---------- Referencia rica (Camiseta) ----------
        $ref = $this->makeReference([
            'code' => 'CAM-0001', 'name' => 'Camiseta Clásica', 'garmentTypeId' => $cam->id, 'collectionId' => $col1->id,
            'fixedCost' => 3000, 'factor' => 2.2,
            'colors' => [[$colors['Blanco']->id, 'PRIMARY'], [$colors['Negro']->id, 'PRIMARY'], [$colors['Rojo']->id, 'SECONDARY'], [$colors['Azul Marino']->id, 'SECONDARY']],
            'sizes' => [$sizes['S']->id, $sizes['M']->id, $sizes['L']->id, $sizes['XL']->id],
            'components' => [['SUPERIOR', 'Cuerpo'], ['SUPERIOR', 'Manga']],
            'materials' => [
                ['input' => $inputs['TEL-01']->id, 'comp' => 0, 'color' => null, 'consumption' => 0.8, 'unitValue' => 12000, 'um' => 'm'],
                ['input' => $inputs['HIL-01']->id, 'comp' => null, 'color' => null, 'consumption' => 0.05, 'unitValue' => 8000, 'um' => 'cono'],
                ['input' => $inputs['ETI-01']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 300, 'um' => 'und'],
                ['input' => $inputs['SRV-02']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 3500, 'um' => 'und'],
                ['input' => $inputs['SRV-01']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 2000, 'um' => 'und'],
            ],
            'groups' => [
                ['name' => 'Nacional', 'market' => 'NATIONAL', 'factor' => 2.2, 'wholesale' => false, 'sizes' => [$sizes['S']->id, $sizes['M']->id, $sizes['L']->id, $sizes['XL']->id],
                 'surcharges' => [[$colors['Rojo']->id, 1500]]],
                ['name' => 'Mayorista', 'market' => 'NATIONAL', 'factor' => 1.8, 'wholesale' => true, 'sizes' => [$sizes['S']->id, $sizes['M']->id, $sizes['L']->id, $sizes['XL']->id], 'surcharges' => []],
                ['name' => 'Exportación', 'market' => 'EXPORT', 'factor' => 2.6, 'wholesale' => false, 'sizes' => [$sizes['8']->id, $sizes['10']->id, $sizes['12']->id, $sizes['14']->id], 'surcharges' => []],
            ],
        ]);

        // ---------- Referencia Hoodie (completa) ----------
        $this->makeReference([
            'code' => 'HOO-0001', 'name' => 'Hoodie Básico', 'garmentTypeId' => $hoo->id, 'collectionId' => $col1->id,
            'fixedCost' => 6000, 'factor' => 2.0,
            'colors' => [[$colors['Gris']->id, 'PRIMARY'], [$colors['Negro']->id, 'PRIMARY'], [$colors['Azul Marino']->id, 'SECONDARY']],
            'sizes' => [$sizes['M']->id, $sizes['L']->id, $sizes['XL']->id],
            'components' => [['SUPERIOR', 'Cuerpo'], ['SUPERIOR', 'Capucha']],
            'materials' => [
                ['input' => $inputs['TEL-01']->id, 'comp' => 0, 'color' => null, 'consumption' => 1.5, 'unitValue' => 15000, 'um' => 'm'],
                ['input' => $inputs['TEL-01']->id, 'comp' => 1, 'color' => null, 'consumption' => 0.4, 'unitValue' => 15000, 'um' => 'm'],
                ['input' => $inputs['CRE-01']->id, 'comp' => 0, 'color' => null, 'consumption' => 1, 'unitValue' => 2500, 'um' => 'und'],
                ['input' => $inputs['HIL-01']->id, 'comp' => null, 'color' => null, 'consumption' => 0.1, 'unitValue' => 8000, 'um' => 'cono'],
                ['input' => $inputs['ETI-01']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 300, 'um' => 'und'],
                ['input' => $inputs['SRV-02']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 5000, 'um' => 'und'],
                ['input' => $inputs['SRV-01']->id, 'comp' => null, 'color' => null, 'consumption' => 1, 'unitValue' => 2500, 'um' => 'und'],
            ],
            'groups' => [
                ['name' => 'Nacional', 'market' => 'NATIONAL', 'factor' => 2.0, 'wholesale' => false, 'sizes' => [$sizes['M']->id, $sizes['L']->id, $sizes['XL']->id], 'surcharges' => [[$colors['Negro']->id, 2000]]],
                ['name' => 'Mayorista', 'market' => 'NATIONAL', 'factor' => 1.7, 'wholesale' => true, 'sizes' => [$sizes['M']->id, $sizes['L']->id, $sizes['XL']->id], 'surcharges' => []],
                ['name' => 'Exportación', 'market' => 'EXPORT', 'factor' => 2.5, 'wholesale' => false, 'sizes' => [$sizes['10']->id, $sizes['12']->id, $sizes['14']->id], 'surcharges' => []],
            ],
        ]);

        // ---------- Referencia conjunto (dos piezas, completa) ----------
        $this->makeReference([
            'code' => 'CJT-0001', 'name' => 'Conjunto Deportivo Niño', 'garmentTypeId' => $cjt->id, 'collectionId' => $col1->id,
            'fixedCost' => 8000, 'factor' => 2.1,
            'colors' => [[$colors['Azul Marino']->id, 'PRIMARY'], [$colors['Rojo']->id, 'PRIMARY'], [$colors['Verde']->id, 'SECONDARY']],
            'sizes' => [$sizes['S']->id, $sizes['M']->id, $sizes['L']->id],
            'components' => [['SUPERIOR', 'Camiseta'], ['INFERIOR', 'Short']],
            'materials' => [
                ['input' => $inputs['TEL-01']->id, 'comp' => 0, 'color' => null, 'consumption' => 0.6, 'unitValue' => 12000, 'um' => 'm'],
                ['input' => $inputs['TEL-01']->id, 'comp' => 1, 'color' => null, 'consumption' => 0.5, 'unitValue' => 12000, 'um' => 'm'],
                ['input' => $inputs['HIL-01']->id, 'comp' => null, 'color' => null, 'consumption' => 0.08, 'unitValue' => 8000, 'um' => 'cono'],
                ['input' => $inputs['ETI-01']->id, 'comp' => null, 'color' => null, 'consumption' => 2, 'unitValue' => 300, 'um' => 'und'],
                ['input' => $inputs['SRV-01']->id, 'comp' => 0, 'color' => null, 'consumption' => 1, 'unitValue' => 2500, 'um' => 'und'],
                ['input' => $inputs['SRV-02']->id, 'comp' => null, 'color' => null, 'consumption' => 2, 'unitValue' => 4000, 'um' => 'und'],
            ],
            'groups' => [
                ['name' => 'Nacional', 'market' => 'NATIONAL', 'factor' => 2.1, 'wholesale' => false, 'sizes' => [$sizes['S']->id, $sizes['M']->id, $sizes['L']->id], 'surcharges' => [[$colors['Rojo']->id, 1000]]],
                ['name' => 'Exportación', 'market' => 'EXPORT', 'factor' => 2.5, 'wholesale' => false, 'sizes' => [$sizes['6']->id, $sizes['8']->id, $sizes['10']->id], 'surcharges' => []],
            ],
        ]);

        // ---------- Orden de producción de ejemplo ----------
        if (! MfgProductionOrder::where('code', 'OP-2026-0001')->exists()) {
            $order = MfgProductionOrder::create([
                'code' => 'OP-2026-0001', 'referenceId' => $ref->id, 'warehouseId' => $bodPT->id, 'status' => 'PROGRAMMED',
                'notes' => 'Orden de ejemplo',
            ]);
            foreach ([['Blanco', 'M', 30], ['Blanco', 'L', 50], ['Negro', 'M', 20], ['Negro', 'L', 25]] as [$col, $ab, $qty]) {
                $order->items()->create(['colorId' => $colors[$col]->id, 'sizeId' => $sizes[$ab]->id, 'quantity' => $qty]);
            }
            foreach (MfgProcess::where('isActive', true)->orderBy('sequence')->get() as $i => $p) {
                $order->stages()->create(['processId' => $p->id, 'sequence' => $p->sequence ?: $i + 1, 'status' => 'PENDING']);
            }
        }

        $this->command?->info('Fábrica: datos de ejemplo cargados.');
    }

    /** Asigna tallas al tipo de prenda por mercado. */
    private function syncTypeSizes(int $garmentTypeId, array $national, array $export): void
    {
        DB::table('mfg_garment_type_sizes')->where('garmentTypeId', $garmentTypeId)->delete();
        $rows = [];
        foreach ($national as $sid) {
            $rows[] = ['garmentTypeId' => $garmentTypeId, 'sizeId' => $sid, 'market' => 'NATIONAL'];
        }
        foreach ($export as $sid) {
            $rows[] = ['garmentTypeId' => $garmentTypeId, 'sizeId' => $sid, 'market' => 'EXPORT'];
        }
        if ($rows) {
            DB::table('mfg_garment_type_sizes')->insert($rows);
        }
    }

    /** Crea una referencia con ficha técnica y calcula sus costos. */
    private function makeReference(array $d): MfgReference
    {
        $existing = MfgReference::where('code', $d['code'])->first();
        if ($existing) {
            return $existing;
        }

        $costVariable = 0.0;
        foreach ($d['materials'] as $m) {
            $costVariable += $m['consumption'] * $m['unitValue'];
        }
        $costUnit = $costVariable + $d['fixedCost'];
        $basePrice = $costUnit * $d['factor'];

        $ref = MfgReference::create([
            'code' => $d['code'], 'name' => $d['name'], 'garmentTypeId' => $d['garmentTypeId'], 'collectionId' => $d['collectionId'],
            'fixedCost' => $d['fixedCost'], 'factor' => $d['factor'],
            'costVariable' => round($costVariable, 2), 'costUnit' => round($costUnit, 2), 'basePrice' => round($basePrice, 2),
        ]);

        foreach ($d['colors'] as [$colorId, $type]) {
            $ref->colors()->create(['colorId' => $colorId, 'colorType' => $type]);
        }
        foreach ($d['sizes'] as $sizeId) {
            $ref->sizes()->create(['sizeId' => $sizeId]);
        }
        $componentIds = [];
        foreach ($d['components'] as [$pos, $desc]) {
            $componentIds[] = $ref->components()->create(['position' => $pos, 'description' => $desc])->id;
        }
        foreach ($d['materials'] as $m) {
            $ref->materials()->create([
                'inputId' => $m['input'], 'colorId' => $m['color'],
                'componentId' => $m['comp'] !== null ? ($componentIds[$m['comp']] ?? null) : null,
                'consumption' => $m['consumption'], 'unitValue' => $m['unitValue'], 'unitOfMeasure' => $m['um'],
            ]);
        }
        foreach ($d['groups'] as $i => $g) {
            $listPrice = round(($costUnit + 0) * $g['factor'], 2);
            $group = $ref->sizeGroups()->create([
                'name' => $g['name'], 'market' => $g['market'], 'fixedCostExtra' => 0, 'factor' => $g['factor'],
                'listPrice' => $listPrice, 'isWholesale' => $g['wholesale'], 'sortOrder' => $i,
            ]);
            foreach ($g['sizes'] as $sizeId) {
                $group->sizes()->create(['sizeId' => $sizeId]);
            }
            foreach ($g['surcharges'] as [$colorId, $amount]) {
                $group->surcharges()->create(['colorId' => $colorId, 'amount' => $amount]);
            }
        }

        return $ref;
    }
}

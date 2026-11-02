import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Dialog, Drawer } from './Overlay';
import { ConfirmProvider, useConfirm } from './Confirm';
import { Combobox } from './Form';
import { ImageInput } from './Media';

describe('Button', () => {
  it('por defecto es type="button" y llama onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('isLoading: deshabilitado, con spinner en lugar del icono, y no dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button isLoading icon={<span data-testid="icono" />} onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toBeDisabled();
    expect(screen.queryByTestId('icono')).toBeNull();
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled: no dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('variante primary usa el color de la app; danger es rojo; fullWidth', () => {
    render(<><Button>A</Button><Button variant="danger" fullWidth>B</Button></>);
    expect(screen.getByRole('button', { name: 'A' }).className).toContain('bg-app-600');
    const b = screen.getByRole('button', { name: 'B' });
    expect(b.className).toContain('bg-red-600');
    expect(b.className).toContain('w-full');
  });

  it('type="submit" envía el formulario', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Button type="submit">Enviar</Button></form>);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog', () => {
  it('cerrado no pinta nada', () => {
    render(<Dialog open={false} onClose={() => {}} title="T">c</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto: título, descripción, contenido y pie; bloquea el scroll del body', () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}} title="Editar" description="desc" footer={<button>Ok</button>}>contenido</Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ok' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape, la X y el fondo llaman onClose', async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T">c</Dialog>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTitle('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('dialog').firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('Escape no hace nada cuando está cerrado', async () => {
    const onClose = vi.fn();
    render(<Dialog open={false} onClose={onClose} title="T">c</Dialog>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Dialog dentro de Dialog: Escape cierra los DOS a la vez', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Dialog open onClose={outer} title="Fuera">
        <Dialog open onClose={inner} title="Dentro">c</Dialog>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    // ACTUAL (posible bug): cada modal escucha Escape en document; no solo se cierra el de arriba.
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('el contenido no recibe el foco al abrir (no hay trampa de foco)', () => {
    render(<Dialog open onClose={() => {}} title="T"><input aria-label="campo" /></Dialog>);
    // ACTUAL: el foco se queda donde estaba (body).
    expect(document.activeElement).toBe(document.body);
  });

  it('Drawer también cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="D">c</Drawer>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useConfirm', () => {
  function Harness({ onResult, opts }: { onResult: (v: boolean) => void; opts?: Parameters<ReturnType<typeof useConfirm>>[0] }) {
    const confirm = useConfirm();
    return <button onClick={async () => onResult(await confirm(opts ?? { title: '¿Eliminar producto?', message: 'No se puede deshacer', tone: 'danger' }))}>abrir</button>;
  }
  const setup = (opts?: Parameters<typeof Harness>[0]['opts']) => {
    const onResult = vi.fn();
    render(<ConfirmProvider><Harness onResult={onResult} opts={opts} /></ConfirmProvider>);
    return onResult;
  };

  it('Aceptar/Eliminar resuelve true y cierra', async () => {
    const onResult = setup();
    await userEvent.click(screen.getByText('abrir'));
    expect(screen.getByRole('heading', { name: '¿Eliminar producto?' })).toBeInTheDocument();
    expect(screen.getByText('No se puede deshacer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancelar resuelve false', async () => {
    const onResult = setup();
    await userEvent.click(screen.getByText('abrir'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('clic en el fondo resuelve false', async () => {
    const onResult = setup();
    await userEvent.click(screen.getByText('abrir'));
    fireEvent.click(screen.getByRole('dialog').firstElementChild!);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('acepta un string como título; tono normal muestra "Aceptar"; textos personalizados', async () => {
    const onResult = setup('¿Seguro?' as never);
    await userEvent.click(screen.getByText('abrir'));
    expect(screen.getByRole('heading', { name: '¿Seguro?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('Escape NO cierra el confirm', async () => {
    const onResult = setup();
    await userEvent.click(screen.getByText('abrir'));
    await userEvent.keyboard('{Escape}');
    // ACTUAL (posible bug): a diferencia de Dialog, el confirm no escucha Escape.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('dos confirm seguidos: la primera promesa nunca se resuelve', async () => {
    let confirmFn!: ReturnType<typeof useConfirm>;
    function Grab() { confirmFn = useConfirm(); return null; }
    render(<ConfirmProvider><Grab /></ConfirmProvider>);
    const first = vi.fn();
    const second = vi.fn();
    act(() => { confirmFn('uno').then(first); });
    act(() => { confirmFn('dos').then(second); });
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(second).toHaveBeenCalledWith(true));
    // ACTUAL (posible bug): el resolver del primero se sobrescribe y queda colgado para siempre.
    expect(first).not.toHaveBeenCalled();
  });

  it('fuera de ConfirmProvider lanza', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() { useConfirm(); return null; }
    expect(() => render(<Bad />)).toThrow('useConfirm debe usarse dentro de ConfirmProvider');
  });
});

describe('Combobox', () => {
  const options = [
    { value: 1, label: 'Camiseta', hint: 'algodón' },
    { value: 2, label: 'Gorra' },
    { value: 3, label: 'Buzo', hint: 'Invierno' },
  ];

  function Single({ onChange }: { onChange?: (v: number | null) => void }) {
    const [v, setV] = useState<number | null>(null);
    return <Combobox options={options} value={v} onChange={(x) => { setV(x); onChange?.(x); }} placeholder="Elige" />;
  }

  it('abre, busca por label o hint (sin mayúsculas) y selecciona', async () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Elige/ }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'INVIER');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['BuzoInvierno']);
    await userEvent.click(screen.getByRole('option'));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button')).toHaveTextContent('Buzo');
  });

  it('sin resultados muestra emptyText', async () => {
    render(<Single />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('la búsqueda no ignora acentos', async () => {
    render(<Combobox options={[{ value: 'a', label: 'Algodón' }]} value={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'algodon');
    // ACTUAL (posible bug): "algodon" no encuentra "Algodón".
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('la X limpia la selección (null)', async () => {
    const onChange = vi.fn();
    const { container } = render(<Combobox options={options} value={2} onChange={onChange} />);
    expect(screen.getByRole('button')).toHaveTextContent('Gorra');
    // La X es un svg con onClick dentro del botón (no es un botón accesible).
    const svgs = container.querySelectorAll('button svg');
    fireEvent.click(svgs[0]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('valor que no está en las opciones: muestra el valor crudo', () => {
    render(<Combobox options={options} value={99} onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('99');
  });

  it('múltiple: agrega y quita sin cerrar la lista', async () => {
    function Multi({ onChange }: { onChange: (v: number[]) => void }) {
      const [v, setV] = useState<number[]>([]);
      return <Combobox multiple options={options} value={v} onChange={(x) => { setV(x); onChange(x); }} />;
    }
    const onChange = vi.fn();
    render(<Multi onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: /Gorra/ }));
    await userEvent.click(screen.getByRole('option', { name: /Camiseta/ }));
    expect(onChange).toHaveBeenLastCalledWith([2, 1]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /Gorra/ }));
    expect(onChange).toHaveBeenLastCalledWith([1]);
  });

  it('clic fuera cierra la lista', async () => {
    render(<><Single /><p>fuera</p></>);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByText('fuera'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('deshabilitado no abre', async () => {
    render(<Combobox options={options} value={null} onChange={() => {}} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('ImageInput', () => {
  const file = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });
  const user = () => userEvent.setup({ applyAccept: false });

  it('imagen válida: entrega un data URL', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value="" onChange={onChange} />);
    await user().upload(container.querySelector('input[type=file]') as HTMLInputElement, file('a.png', 'image/png', 10));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
  });

  it('archivo que no es imagen: muestra error y no llama onChange', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value={null} onChange={onChange} />);
    await user().upload(container.querySelector('input[type=file]') as HTMLInputElement, file('doc.pdf', 'application/pdf', 10));
    expect(await screen.findByText('"doc.pdf" no es un tipo de archivo permitido')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('imagen más pesada que maxSizeMB: error con el tamaño', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value={null} onChange={onChange} maxSizeMB={1} />);
    await user().upload(container.querySelector('input[type=file]') as HTMLInputElement, file('big.jpg', 'image/jpeg', 1024 * 1024 + 1));
    expect(await screen.findByText('"big.jpg" pesa 1.0 MB; el máximo es 1 MB')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('exactamente maxSizeMB se acepta', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value={null} onChange={onChange} maxSizeMB={1} />);
    await user().upload(container.querySelector('input[type=file]') as HTMLInputElement, file('ok.jpg', 'image/jpeg', 1024 * 1024));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('un archivo válido después de uno inválido borra el error', async () => {
    const { container } = render(<ImageInput value={null} onChange={() => {}} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await user().upload(input, file('doc.pdf', 'application/pdf', 1));
    expect(await screen.findByText(/no es un tipo de archivo permitido/)).toBeInTheDocument();
    await user().upload(input, file('a.png', 'image/png', 1));
    await waitFor(() => expect(screen.queryByText(/no es un tipo de archivo permitido/)).toBeNull());
  });

  it('SVG se acepta como imagen (image/svg+xml cae en image/*)', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value={null} onChange={onChange} />);
    await user().upload(container.querySelector('input[type=file]') as HTMLInputElement, file('x.svg', 'image/svg+xml', 5));
    // ACTUAL (posible riesgo): SVG puede llevar scripts; aquí se acepta como cualquier imagen.
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('con valor: muestra la imagen y "Quitar" entrega cadena vacía', async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageInput value="https://x/a.png" onChange={onChange} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/a.png');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('modo enlace: Enter entrega la URL recortada', async () => {
    const onChange = vi.fn();
    render(<ImageInput value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Usar un enlace/ }));
    await userEvent.type(screen.getByPlaceholderText('https://…/imagen.jpg'), '  https://x/b.png  {Enter}');
    expect(onChange).toHaveBeenCalledWith('https://x/b.png');
  });

  it('modo enlace: no valida que sea una URL', async () => {
    const onChange = vi.fn();
    render(<ImageInput value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Usar un enlace/ }));
    await userEvent.type(screen.getByPlaceholderText('https://…/imagen.jpg'), 'javascript:alert(1){Enter}');
    // ACTUAL: cualquier texto se acepta como "enlace".
    expect(onChange).toHaveBeenCalledWith('javascript:alert(1)');
  });

  it('allowUrl=false oculta "Usar un enlace"; disabled oculta el enlace y deshabilita la zona', () => {
    const { rerender } = render(<ImageInput value={null} onChange={() => {}} allowUrl={false} />);
    expect(screen.queryByText(/Usar un enlace/)).toBeNull();
    rerender(<ImageInput value={null} onChange={() => {}} disabled />);
    expect(screen.queryByText(/Usar un enlace/)).toBeNull();
    expect(screen.getByRole('button', { name: /Subir imagen/ })).toBeDisabled();
  });
});

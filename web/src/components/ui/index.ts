// Kit del estándar de diseño (ver web/DESIGN_SYSTEM.md). Toda vista nueva o modificada usa estas piezas.
export { AppTheme } from './AppTheme';
export { Button, IconButton, buttonClass, type ButtonVariant, type ButtonSize } from './Button';
export { Page, PageHeader, Card, CardTitle, StatCard, Badge, EmptyState, Spinner, type Tone } from './Layout';
export {
  Field, TextInput, AddonInput, NumberInput, MoneyInput, DateInput, SelectInput, TextArea, ColorInput,
  Checkbox, Switch, RadioGroup, Combobox, SearchInput, FilterBar, FormGrid, FormActions, fieldClass, type Option,
} from './Form';
export { FileDrop, FileList, ImageInput, ImageGallery, Thumb, Avatar } from './Media';
export { Dialog, Drawer, ActionMenu, type MenuItem } from './Overlay';
export { Alert, Tabs, Breadcrumbs, DescriptionList, Timeline, Skeleton, Pager, SettingsSection } from './Display';
export { TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage } from './Table';
export { ConfirmProvider, useConfirm } from './Confirm';
export { default as toast } from '../../lib/toast';

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Award,
  BarChart3,
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PackagePlus,
  Settings,
  Shield,
  ShoppingBag,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { auth, testConnection } from './firebase';
import {
  isUserBootstrappedAdmin,
  registerPartnerNode,
  seedInitialViveNextData,
  subscribeAuditLogs,
  subscribeCommissions,
  subscribeOrders,
  subscribePartners,
  subscribePlanConfig,
  subscribeProducts,
  subscribeWithdrawals,
} from './services/firestoreService';
import type {
  AuditLog,
  BinaryLeg,
  CartItem,
  Commission,
  Order,
  PackageTier,
  Partner,
  PlanConfig,
  Product,
  Withdrawal,
} from './types/vivenext';
import { AuthGate, type LoginRoleIntent } from './components/AuthGate';
import { DashboardReportsModule } from './components/DashboardReportsModule';
import { NetworkModule } from './components/NetworkModule';
import { CompensationModule } from './components/CompensationModule';
import { WalletModule } from './components/WalletModule';
import { StoreModule } from './components/StoreModule';
import { AdminModule, type AdminSection } from './components/AdminModule';
import { ErrorBoundary } from './components/ErrorBoundary';

type AffiliateModule = 'dashboard' | 'network' | 'compensation' | 'wallet' | 'store';
type PanelMode = 'admin' | 'socio';

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [loginIntent, setLoginIntent] = useState<LoginRoleIntent | null>(null);
  const [nonAdminNotice, setNonAdminNotice] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('socio');
  const [panelInitialized, setPanelInitialized] = useState(false);
  const [affiliateTab, setAffiliateTab] = useState<AffiliateModule>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSection>('resumen');
  const [adminViewMode, setAdminViewMode] = useState<
    'control' | 'marketplace' | 'reports' | 'network' | 'compensation'
  >('control');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      setPanelInitialized(false);
      setNonAdminNotice(false);
    });
    return () => unsub();
  }, []);

  const isBootAdmin = useMemo(
    () => isUserBootstrappedAdmin(user?.email, user?.emailVerified),
    [user]
  );

  // Public Marketplace active products subscription (for pre-login landing & storefront)
  useEffect(() => {
    const unsubProducts = subscribeProducts(isBootAdmin, setProducts);
    return () => unsubProducts();
  }, [isBootAdmin]);

  useEffect(() => {
    if (!user) {
      setPartners([]);
      setOrders([]);
      setCommissions([]);
      setWithdrawals([]);
      setAuditLogs([]);
      setDataLoaded(false);
      return;
    }

    let cancelled = false;
    const init = async () => {
      if (isBootAdmin) {
        setSeeding(true);
        try {
          await seedInitialViveNextData(
            user.uid,
            user.email || 'admin@vivenext.bo',
            user.displayName || 'Dirección Visión Next'
          );
        } finally {
          if (!cancelled) setSeeding(false);
        }
      }
    };
    init();

    const unsubs = [
      subscribePartners(user.uid, isBootAdmin, (list) => {
        setPartners(list);
        setDataLoaded(true);
      }),
      subscribeOrders(user.uid, isBootAdmin, setOrders),
      subscribeCommissions(user.uid, isBootAdmin, setCommissions),
      subscribeWithdrawals(user.uid, isBootAdmin, setWithdrawals),
      subscribePlanConfig(setPlanConfig),
    ];

    if (isBootAdmin) {
      unsubs.push(subscribeAuditLogs(setAuditLogs));
    }

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user, isBootAdmin]);

  const currentPartner = useMemo(() => {
    if (!user) return null;
    return (
      partners.find((p) => p.id === user.uid) ||
      (isBootAdmin ? partners.find((p) => p.id === 'vn_root') : undefined) ||
      partners.find((p) => p.ownerUid === user.uid) ||
      null
    );
  }, [partners, user, isBootAdmin]);

  const isAdmin = isBootAdmin;

  useEffect(() => {
    if (dataLoaded && !panelInitialized) {
      if (isAdmin) {
        setPanelMode(loginIntent === 'socio' ? 'socio' : 'admin');
      } else {
        setPanelMode('socio');
        if (loginIntent === 'admin') {
          setNonAdminNotice(true);
        }
      }
      setPanelInitialized(true);
    }
  }, [dataLoaded, isAdmin, panelInitialized, loginIntent]);

  const effectivePanel: PanelMode = isAdmin ? panelMode : 'socio';

  const handleCompleteOnboarding = async (payload: {
    fullName: string;
    sponsorId: string;
    binaryLeg: BinaryLeg;
    packageTier: PackageTier;
    phone: string;
    ciNumber: string;
    city: string;
    bankName: string;
    bankAccount: string;
  }) => {
    if (!user) return;
    await registerPartnerNode({
      id: user.uid,
      ownerUid: user.uid,
      fullName: payload.fullName,
      sponsorId: payload.sponsorId,
      binaryParentId: payload.sponsorId,
      binaryLeg: payload.binaryLeg,
      packageTier: payload.packageTier,
      uplineUids: [user.uid],
      email: user.email || '',
      phone: payload.phone,
      ciNumber: payload.ciNumber,
      city: payload.city,
      bankName: payload.bankName,
      bankAccount: payload.bankAccount,
    });
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  if (!authReady || (user && (!dataLoaded || seeding))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-base font-display font-bold text-slate-900">Vive Next</div>
          <div className="text-xs text-slate-500">Cargando oficina virtual y Marketplace...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        mode="login"
        marketplaceProducts={products}
        onSelectLoginIntent={(intent) => setLoginIntent(intent)}
      />
    );
  }

  if (!currentPartner) {
    return (
      <AuthGate
        mode="onboarding"
        userEmail={user.email || ''}
        userName={user.displayName || ''}
        userUid={user.uid}
        onCompleteOnboarding={handleCompleteOnboarding}
      />
    );
  }

  const affiliateNavItems: Array<{
    id: AffiliateModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Mi Resumen y Reportes', icon: BarChart3 },
    { id: 'network', label: 'Mi Red de Afiliados', icon: Network },
    { id: 'compensation', label: 'Rangos y Bonos', icon: Award },
    { id: 'wallet', label: 'Mi Billetera', icon: Wallet },
    { id: 'store', label: 'Marketplace', icon: ShoppingBag },
  ];

  const adminNavItems: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    active: boolean;
  }> = [
    {
      key: 'resumen',
      label: 'Control y Minipanel',
      icon: LayoutDashboard,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('resumen');
      },
      active: adminViewMode === 'control' && adminSection === 'resumen',
    },
    {
      key: 'productos',
      label: 'Subir Productos (Marketplace)',
      icon: PackagePlus,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('productos');
      },
      active: adminViewMode === 'control' && adminSection === 'productos',
    },
    {
      key: 'marketplace',
      label: 'Marketplace (Vista)',
      icon: ShoppingBag,
      onClick: () => setAdminViewMode('marketplace'),
      active: adminViewMode === 'marketplace',
    },
    {
      key: 'pedidos',
      label: 'Pedidos y Pagos',
      icon: FileCheck,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('pedidos');
      },
      active: adminViewMode === 'control' && adminSection === 'pedidos',
    },
    {
      key: 'comisiones',
      label: 'Comisiones y Retiros',
      icon: Wallet,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('comisiones');
      },
      active: adminViewMode === 'control' && adminSection === 'comisiones',
    },
    {
      key: 'socios',
      label: 'Gestión de Afiliados',
      icon: Users,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('socios');
      },
      active: adminViewMode === 'control' && adminSection === 'socios',
    },
    {
      key: 'network',
      label: 'Árbol Completo de Red',
      icon: Network,
      onClick: () => setAdminViewMode('network'),
      active: adminViewMode === 'network',
    },
    {
      key: 'reports',
      label: 'Reportes PDF / Excel',
      icon: BarChart3,
      onClick: () => setAdminViewMode('reports'),
      active: adminViewMode === 'reports',
    },
    {
      key: 'config',
      label: 'Parámetros del Plan',
      icon: Settings,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('config');
      },
      active: adminViewMode === 'control' && adminSection === 'config',
    },
    {
      key: 'auditoria',
      label: 'Auditoría',
      icon: ClipboardList,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('auditoria');
      },
      active: adminViewMode === 'control' && adminSection === 'auditoria',
    },
  ];

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const renderSidebarBody = (closeMobile?: () => void) => (
    <>
      <div
        className={`h-16 px-6 flex items-center justify-between border-b ${
          effectivePanel === 'admin'
            ? 'bg-[#8B1E24] text-white border-[#73181D]'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
          Vive Next
        </span>
        {closeMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className={`p-1 cursor-pointer ${effectivePanel === 'admin' ? 'text-white/80' : 'text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Role Switcher strictly visible to Bootstrapped Admin */}
      {isAdmin && (
        <div className="px-3 pt-4 pb-2">
          <div className="text-[11px] font-medium text-slate-500 px-1 mb-1.5">Cambiar de Panel</div>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setPanelMode('admin');
                if (closeMobile) closeMobile();
              }}
              className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                effectivePanel === 'admin'
                  ? 'bg-[#8B1E24] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Administrador
            </button>
            <button
              type="button"
              onClick={() => {
                setPanelMode('socio');
                if (closeMobile) closeMobile();
              }}
              className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                effectivePanel === 'socio'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Afiliado
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {effectivePanel === 'admin' ? (
          adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onClick();
                  if (closeMobile) closeMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  item.active
                    ? 'bg-[#8B1E24] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        ) : (
          affiliateNavItems.map((item) => {
            const Icon = item.icon;
            const active = affiliateTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAffiliateTab(item.id);
                  if (closeMobile) closeMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#8B1E24] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="text-xs">
          <div className="font-semibold text-slate-900 truncate">{currentPartner.fullName}</div>
          <div className="text-slate-500 truncate">
            {effectivePanel === 'admin' ? 'Administrador · Acceso total' : 'Afiliado · Oficina virtual'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoginIntent(null);
            signOut(auth);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        {renderSidebarBody()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col border-r border-slate-200 z-10">
            {renderSidebarBody(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 zones */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-500 truncate">
              <span>{effectivePanel === 'admin' ? 'Panel de Administrador' : 'Panel de Afiliado'}</span>
              <span className="mx-1.5">/</span>
              <span className="font-semibold text-slate-900">
                {effectivePanel === 'admin'
                  ? adminNavItems.find((i) => i.active)?.label || 'Administración'
                  : affiliateNavItems.find((i) => i.id === affiliateTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {effectivePanel === 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  setAdminViewMode('control');
                  setAdminSection('productos');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Subir Productos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAffiliateTab('store')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#8B1E24]" />
                <span>Marketplace ({cartCount})</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
          {nonAdminNotice && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
              <span>
                Tu cuenta tiene permisos de <strong>Afiliado</strong>. El Panel de Administrador está reservado exclusivamente para cuentas autorizadas.
              </span>
              <button
                type="button"
                onClick={() => setNonAdminNotice(false)}
                className="text-amber-700 hover:text-amber-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {effectivePanel === 'admin' ? (
            <>
              {adminViewMode === 'control' && (
                <AdminModule
                  activeSection={adminSection}
                  onChangeSection={setAdminSection}
                  partners={partners}
                  products={products}
                  orders={orders}
                  commissions={commissions}
                  withdrawals={withdrawals}
                  planConfig={planConfig}
                  auditLogs={auditLogs}
                />
              )}
              {adminViewMode === 'marketplace' && (
                <StoreModule
                  currentPartner={currentPartner}
                  products={products}
                  orders={orders}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                  onRemoveFromCart={(id) => setCart((prev) => prev.filter((c) => c.product.id !== id))}
                  onClearCart={() => setCart([])}
                  isAdminView
                  onOpenAdminProductUpload={() => {
                    setAdminViewMode('control');
                    setAdminSection('productos');
                  }}
                />
              )}
              {adminViewMode === 'network' && (
                <NetworkModule
                  currentPartner={currentPartner}
                  partners={partners}
                  currentUserUid={user.uid}
                />
              )}
              {adminViewMode === 'reports' && (
                <DashboardReportsModule
                  currentPartner={currentPartner}
                  partners={partners}
                  orders={orders}
                  commissions={commissions}
                  planConfig={planConfig}
                  onNavigate={(tab) => {
                    if (tab === 'network') setAdminViewMode('network');
                    else if (tab === 'compensation') setAdminViewMode('compensation');
                    else if (tab === 'store') setAdminViewMode('marketplace');
                    else {
                      setAdminViewMode('control');
                      setAdminSection('resumen');
                    }
                  }}
                />
              )}
              {adminViewMode === 'compensation' && (
                <CompensationModule currentPartner={currentPartner} planConfig={planConfig} />
              )}
            </>
          ) : (
            <>
              {affiliateTab === 'dashboard' && (
                <DashboardReportsModule
                  currentPartner={currentPartner}
                  partners={partners}
                  orders={orders}
                  commissions={commissions}
                  planConfig={planConfig}
                  onNavigate={(tab) => {
                    if (tab !== 'admin') setAffiliateTab(tab);
                  }}
                />
              )}
              {affiliateTab === 'network' && (
                <NetworkModule
                  currentPartner={currentPartner}
                  partners={partners}
                  currentUserUid={user.uid}
                />
              )}
              {affiliateTab === 'compensation' && (
                <CompensationModule currentPartner={currentPartner} planConfig={planConfig} />
              )}
              {affiliateTab === 'wallet' && (
                <WalletModule
                  currentPartner={currentPartner}
                  isAdmin={false}
                  commissions={commissions}
                  withdrawals={withdrawals}
                />
              )}
              {affiliateTab === 'store' && (
                <StoreModule
                  currentPartner={currentPartner}
                  products={products}
                  orders={orders}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                  onRemoveFromCart={(id) => setCart((prev) => prev.filter((c) => c.product.id !== id))}
                  onClearCart={() => setCart([])}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

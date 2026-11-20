import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AFFILIATION_PACKAGES,
  CV_TO_BS_DEFAULT,
  RANK_MAP,
  determineQualifiedRank,
} from '../data/compensationPlan';
import type {
  AuditLog,
  BinaryLeg,
  BonusType,
  Commission,
  CommissionStatus,
  Order,
  PackageTier,
  Partner,
  PartnerPrivateInfo,
  PlanConfig,
  Product,
  RankId,
  UserRole,
  Withdrawal,
} from '../types/vivenext';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'gjjkjljhgjklh6@gmail.com';

export function isUserBootstrappedAdmin(email?: string | null, emailVerified?: boolean | null): boolean {
  return Boolean(emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL);
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function formatPeriodMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function logAudit(
  action: string,
  targetCollection: string,
  targetId: string,
  summary: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const id = makeId('aud');
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorUid: user.uid,
      actorEmail: user.email ?? 'admin@vivenext.bo',
      action,
      targetCollection,
      targetId,
      summary: summary.slice(0, 390),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}

export async function seedInitialViveNextData(adminUid: string, adminEmail: string, adminName: string): Promise<void> {
  try {
    const configSnap = await getDoc(doc(db, 'plan_config', 'default'));
    if (configSnap.exists()) return;

    await setDoc(doc(db, 'admins', adminUid), {
      uid: adminUid,
      email: adminEmail,
      role: 'admin',
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'plan_config', 'default'), {
      id: 'default',
      cvToBsRate: 5,
      minMonthlyPv: 75,
      maxPayoutRatioPercent: 48,
      binaryEquilibriumPercent: 30,
      minRealConsumptionBs: 350,
      accumulationMaxDays: 30,
      firstWeekEndDay: 7,
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });

    const seedProducts: Array<Omit<Product, 'createdAt' | 'updatedAt'>> = [
      {
        id: 'pkg_base',
        sku: 'VN-PKG-BASE',
        name: 'Paquete Distribuidor Base',
        category: 'Paquetes de Afiliación',
        isPackage: true,
        packageTier: 'base',
        retailPriceBs: 1125,
        wholesalePriceBs: 750,
        firstPurchaseSurchargeBs: 225,
        pv: 75,
        cv: 60,
        stock: 250,
        active: true,
        imageUrl: '/src/assets/images/product_energia_matcha_1794920092488.jpg',
        description: 'Acceso inicial Vive Next: Venta Directa (50% margen) y Bono de Inicio Rápido (30% en 3 niveles). Incluye 75 PV / 60 CV.',
      },
      {
        id: 'pkg_emprendedor',
        sku: 'VN-PKG-EMP',
        name: 'Paquete Emprendedor',
        category: 'Paquetes de Afiliación',
        isPackage: true,
        packageTier: 'emprendedor',
        retailPriceBs: 2250,
        wholesalePriceBs: 1500,
        firstPurchaseSurchargeBs: 450,
        pv: 150,
        cv: 120,
        stock: 180,
        active: true,
        imageUrl: '/src/assets/images/product_colageno_next_1794920093968.jpg',
        description: 'Plan de expansión mensual: Venta Directa (50%), Inicio Rápido (30%) y Bono Unilevel Residual del 20% fijo. 150 PV / 120 CV.',
      },
      {
        id: 'pkg_elite',
        sku: 'VN-PKG-ELITE',
        name: 'Paquete Emprendedor Élite',
        category: 'Paquetes de Afiliación',
        isPackage: true,
        packageTier: 'elite',
        retailPriceBs: 4500,
        wholesalePriceBs: 3000,
        firstPurchaseSurchargeBs: 900,
        pv: 300,
        cv: 240,
        stock: 120,
        active: true,
        imageUrl: '/src/assets/images/product_elixir_vital_1794920091552.jpg',
        description: 'Acceso integral a los 9 bonos: Binario Híbrido, Binario Progresivo +5%, Matching Bonus 54%, Fondo de Liderazgo, Piscinas y Premios.',
      },
      {
        id: 'prod_elixir',
        sku: 'VN-ELX-01',
        name: 'Elixir Botánico Vital',
        category: 'Bienestar Celular',
        isPackage: false,
        packageTier: 'none',
        retailPriceBs: 360,
        wholesalePriceBs: 240,
        firstPurchaseSurchargeBs: 0,
        pv: 45,
        cv: 36,
        stock: 140,
        active: true,
        imageUrl: '/src/assets/images/product_elixir_vital_1794920091552.jpg',
        description: 'Concentrado botánico antioxidante de alta absorción para vitalidad diaria e inmunidad celular. Margen mayorista 50%.',
      },
      {
        id: 'prod_colageno',
        sku: 'VN-COL-02',
        name: 'Colágeno Hidrolizado Next',
        category: 'Nutrición Avanzada',
        isPackage: false,
        packageTier: 'none',
        retailPriceBs: 450,
        wholesalePriceBs: 300,
        firstPurchaseSurchargeBs: 0,
        pv: 55,
        cv: 44,
        stock: 96,
        active: true,
        imageUrl: '/src/assets/images/product_colageno_next_1794920093968.jpg',
        description: 'Péptidos bioactivos de colágeno tipo I y III con vitamina C orgánica para articulaciones, piel y recuperación muscular.',
      },
      {
        id: 'prod_matcha',
        sku: 'VN-MTC-03',
        name: 'Superfood Matcha Energía',
        category: 'Energía y Enfoque',
        isPackage: false,
        packageTier: 'none',
        retailPriceBs: 330,
        wholesalePriceBs: 220,
        firstPurchaseSurchargeBs: 0,
        pv: 40,
        cv: 32,
        stock: 112,
        active: true,
        imageUrl: '/src/assets/images/product_energia_matcha_1794920092488.jpg',
        description: 'Fórmula adaptógena de matcha ceremonial y guaraná amazónico para energía limpia sostenida sin picos glucémicos.',
      },
      {
        id: 'prod_omega',
        sku: 'VN-OMG-04',
        name: 'Omega-3 Pure Cellular',
        category: 'Salud Cardiovascular',
        isPackage: false,
        packageTier: 'none',
        retailPriceBs: 390,
        wholesalePriceBs: 260,
        firstPurchaseSurchargeBs: 0,
        pv: 50,
        cv: 40,
        stock: 84,
        active: true,
        imageUrl: '/src/assets/images/product_omega_pure_1794920093366.jpg',
        description: 'Ácidos grasos esenciales EPA/DHA purificados molecularmente para función cerebral, visión y equilibrio lipídico.',
      },
    ];

    for (const p of seedProducts) {
      await setDoc(doc(db, 'products', p.id), {
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const seedPartners: Array<Omit<Partner, 'joinedAt' | 'updatedAt'> & { city: string; phone: string }> = [
      {
        id: 'vn_root',
        ownerUid: adminUid,
        fullName: adminName || 'Dirección Visión Next',
        referralCode: 'VN-VISION-01',
        sponsorId: '',
        binaryParentId: '',
        binaryLeg: 'root',
        packageTier: 'elite',
        rankId: 'platino',
        status: 'activo',
        role: 'admin',
        personalPv: 300,
        personalCv: 240,
        leftBranchCv: 6800,
        rightBranchCv: 5400,
        teamCv: 12200,
        directCount: 3,
        activeLines: 5,
        firstWeekPurchase: true,
        uplineUids: [adminUid],
        city: 'Santa Cruz de la Sierra',
        phone: '+591 77012400',
      },
      {
        id: 'vn_p_valeria',
        ownerUid: adminUid,
        fullName: 'Valeria Mendoza Rojas',
        referralCode: 'VN-VAL-102',
        sponsorId: 'vn_root',
        binaryParentId: 'vn_root',
        binaryLeg: 'left',
        packageTier: 'elite',
        rankId: 'oro',
        status: 'activo',
        role: 'lider',
        personalPv: 195,
        personalCv: 156,
        leftBranchCv: 2900,
        rightBranchCv: 2450,
        teamCv: 5350,
        directCount: 2,
        activeLines: 3,
        firstWeekPurchase: true,
        uplineUids: [adminUid],
        city: 'Santa Cruz de la Sierra',
        phone: '+591 76341120',
      },
      {
        id: 'vn_p_carlos',
        ownerUid: adminUid,
        fullName: 'Carlos Justiniano Paz',
        referralCode: 'VN-CAR-103',
        sponsorId: 'vn_root',
        binaryParentId: 'vn_root',
        binaryLeg: 'right',
        packageTier: 'elite',
        rankId: 'plata',
        status: 'activo',
        role: 'lider',
        personalPv: 150,
        personalCv: 120,
        leftBranchCv: 1900,
        rightBranchCv: 1620,
        teamCv: 3520,
        directCount: 2,
        activeLines: 2,
        firstWeekPurchase: true,
        uplineUids: [adminUid],
        city: 'Cochabamba',
        phone: '+591 71482090',
      },
      {
        id: 'vn_p_lucia',
        ownerUid: adminUid,
        fullName: 'Lucía Saucedo Terrazas',
        referralCode: 'VN-LUC-104',
        sponsorId: 'vn_p_valeria',
        binaryParentId: 'vn_p_valeria',
        binaryLeg: 'left',
        packageTier: 'elite',
        rankId: 'bronce',
        status: 'activo',
        role: 'socio',
        personalPv: 150,
        personalCv: 120,
        leftBranchCv: 980,
        rightBranchCv: 760,
        teamCv: 1740,
        directCount: 1,
        activeLines: 2,
        firstWeekPurchase: true,
        uplineUids: [adminUid],
        city: 'La Paz',
        phone: '+591 72051900',
      },
      {
        id: 'vn_p_diego',
        ownerUid: adminUid,
        fullName: 'Diego Arce Villarroel',
        referralCode: 'VN-DIE-105',
        sponsorId: 'vn_p_valeria',
        binaryParentId: 'vn_p_valeria',
        binaryLeg: 'right',
        packageTier: 'emprendedor',
        rankId: 'consultor_elite',
        status: 'activo',
        role: 'socio',
        personalPv: 95,
        personalCv: 76,
        leftBranchCv: 420,
        rightBranchCv: 280,
        teamCv: 700,
        directCount: 0,
        activeLines: 1,
        firstWeekPurchase: false,
        uplineUids: [adminUid],
        city: 'Tarija',
        phone: '+591 75120344',
      },
      {
        id: 'vn_p_andrea',
        ownerUid: adminUid,
        fullName: 'Andrea Ribera Chávez',
        referralCode: 'VN-AND-106',
        sponsorId: 'vn_p_carlos',
        binaryParentId: 'vn_p_carlos',
        binaryLeg: 'left',
        packageTier: 'elite',
        rankId: 'consultor_elite',
        status: 'activo',
        role: 'socio',
        personalPv: 165,
        personalCv: 132,
        leftBranchCv: 540,
        rightBranchCv: 360,
        teamCv: 900,
        directCount: 1,
        activeLines: 1,
        firstWeekPurchase: true,
        uplineUids: [adminUid],
        city: 'Santa Cruz de la Sierra',
        phone: '+591 78044511',
      },
      {
        id: 'vn_p_mateo',
        ownerUid: adminUid,
        fullName: 'Mateo Torrico Suárez',
        referralCode: 'VN-MAT-107',
        sponsorId: 'vn_p_carlos',
        binaryParentId: 'vn_p_carlos',
        binaryLeg: 'right',
        packageTier: 'base',
        rankId: 'consultor_elite',
        status: 'pendiente',
        role: 'socio',
        personalPv: 45,
        personalCv: 36,
        leftBranchCv: 0,
        rightBranchCv: 0,
        teamCv: 36,
        directCount: 0,
        activeLines: 0,
        firstWeekPurchase: false,
        uplineUids: [adminUid],
        city: 'Sucre',
        phone: '+591 73901122',
      },
    ];

    for (const sp of seedPartners) {
      const { city, phone, ...partnerDoc } = sp;
      await setDoc(doc(db, 'partners', partnerDoc.id), {
        ...partnerDoc,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'partners', partnerDoc.id, 'private', 'info'), {
        partnerId: partnerDoc.id,
        ownerUid: adminUid,
        email: partnerDoc.id === 'vn_root' ? adminEmail : `${partnerDoc.id.replace('vn_p_', '')}@vivenext.bo`,
        phone,
        ciNumber: `SC-${Math.floor(4200000 + Math.random() * 5000000)}`,
        city,
        bankName: 'Banco Mercantil Santa Cruz',
        bankAccount: `4010-${Math.floor(100000 + Math.random() * 899999)}`,
        updatedAt: serverTimestamp(),
      });
    }

    const seedOrders: Array<Omit<Order, 'createdAt' | 'updatedAt'>> = [
      {
        id: 'ord_seed_1001',
        orderNumber: 'VN-2026-1001',
        buyerUid: adminUid,
        partnerId: 'vn_p_valeria',
        partnerName: 'Valeria Mendoza Rojas',
        sponsorId: 'vn_root',
        isFirstPurchase: true,
        items: [
          {
            productId: 'pkg_elite',
            sku: 'VN-PKG-ELITE',
            name: 'Paquete Emprendedor Élite',
            quantity: 1,
            unitWholesaleBs: 3000,
            unitRetailBs: 4500,
            unitSurchargeBs: 900,
            unitPv: 300,
            unitCv: 240,
            isPackage: true,
            packageTier: 'elite',
          },
        ],
        subtotalBs: 3000,
        surchargeBs: 900,
        totalBs: 3900,
        totalPv: 300,
        totalCv: 240,
        paymentMethod: 'qr',
        paymentReference: 'QR-BMSC-884210',
        receiptNote: 'Pago QR Simple validado en cuenta corporativa Santa Cruz',
        paymentStatus: 'validado',
        validatedBy: adminEmail,
      },
      {
        id: 'ord_seed_1002',
        orderNumber: 'VN-2026-1002',
        buyerUid: adminUid,
        partnerId: 'vn_p_andrea',
        partnerName: 'Andrea Ribera Chávez',
        sponsorId: 'vn_p_carlos',
        isFirstPurchase: false,
        items: [
          {
            productId: 'prod_colageno',
            sku: 'VN-COL-02',
            name: 'Colágeno Hidrolizado Next',
            quantity: 2,
            unitWholesaleBs: 300,
            unitRetailBs: 450,
            unitSurchargeBs: 0,
            unitPv: 55,
            unitCv: 44,
            isPackage: false,
            packageTier: 'none',
          },
          {
            productId: 'prod_elixir',
            sku: 'VN-ELX-01',
            name: 'Elixir Botánico Vital',
            quantity: 1,
            unitWholesaleBs: 240,
            unitRetailBs: 360,
            unitSurchargeBs: 0,
            unitPv: 45,
            unitCv: 36,
            isPackage: false,
            packageTier: 'none',
          },
        ],
        subtotalBs: 840,
        surchargeBs: 0,
        totalBs: 840,
        totalPv: 155,
        totalCv: 124,
        paymentMethod: 'efectivo',
        paymentReference: 'CAJA-SCZ-0412',
        receiptNote: 'Cancelado en efectivo oficina Equipetrol, pendiente de arqueo',
        paymentStatus: 'pendiente',
        validatedBy: '',
      },
      {
        id: 'ord_seed_1003',
        orderNumber: 'VN-2026-1003',
        buyerUid: adminUid,
        partnerId: 'vn_p_mateo',
        partnerName: 'Mateo Torrico Suárez',
        sponsorId: 'vn_p_carlos',
        isFirstPurchase: true,
        items: [
          {
            productId: 'pkg_emprendedor',
            sku: 'VN-PKG-EMP',
            name: 'Paquete Emprendedor',
            quantity: 1,
            unitWholesaleBs: 1500,
            unitRetailBs: 2250,
            unitSurchargeBs: 450,
            unitPv: 150,
            unitCv: 120,
            isPackage: true,
            packageTier: 'emprendedor',
          },
        ],
        subtotalBs: 1500,
        surchargeBs: 450,
        totalBs: 1950,
        totalPv: 150,
        totalCv: 120,
        paymentMethod: 'qr',
        paymentReference: 'QR-BNB-552109',
        receiptNote: 'Upgrade a Paquete Emprendedor vía QR BNB',
        paymentStatus: 'pendiente',
        validatedBy: '',
      },
    ];

    for (const o of seedOrders) {
      await setDoc(doc(db, 'orders', o.id), {
        ...o,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const period = formatPeriodMonth();
    const seedCommissions: Array<Omit<Commission, 'createdAt'>> = [
      {
        id: 'com_seed_1',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        sourceOrderId: 'ord_seed_1001',
        bonusType: 'B2_INICIO_RAPIDO',
        level: 1,
        baseCv: 240,
        ratePercent: 25,
        amountBs: 750,
        status: 'disponible',
        periodMonth: period,
        description: 'Inicio Rápido Nivel 1 (25%) por afiliación Élite de Valeria Mendoza',
      },
      {
        id: 'com_seed_2',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        sourceOrderId: 'cycle_prev',
        bonusType: 'B3_UNILEVEL',
        level: 1,
        baseCv: 1850,
        ratePercent: 20,
        amountBs: 1850,
        status: 'disponible',
        periodMonth: period,
        description: 'Unilevel Residual 20% fijo · Captura de líneas activas Platino',
      },
      {
        id: 'com_seed_3',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        sourceOrderId: 'cycle_prev',
        bonusType: 'B4_BINARIO',
        level: 0,
        baseCv: 5400,
        ratePercent: 14,
        amountBs: 3780,
        status: 'disponible',
        periodMonth: period,
        description: 'Binario Híbrido 14% Platino sobre 5.400 CV rama menor (1 CV = 5 Bs)',
      },
      {
        id: 'com_seed_4',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        sourceOrderId: 'cycle_prev',
        bonusType: 'B5_BINARIO_PROGRESIVO',
        level: 0,
        baseCv: 5400,
        ratePercent: 5,
        amountBs: 1350,
        status: 'disponible',
        periodMonth: period,
        description: 'Binario Progresivo +5% Extra por recompra en días 1–7 del mes',
      },
      {
        id: 'com_seed_5',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        sourceOrderId: 'cycle_prev',
        bonusType: 'B6_MATCHING',
        level: 1,
        baseCv: 1592,
        ratePercent: 50,
        amountBs: 796,
        status: 'pagada',
        periodMonth: period,
        description: 'Matching Bonus 50% Nivel 1 sobre Bono Binario de directos',
      },
    ];

    for (const c of seedCommissions) {
      await setDoc(doc(db, 'commissions', c.id), {
        ...c,
        createdAt: serverTimestamp(),
      });
    }

    const seedWithdrawals: Array<Omit<Withdrawal, 'createdAt' | 'updatedAt'>> = [
      {
        id: 'wdr_seed_1',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        amountBs: 1200,
        method: 'transferencia_bancaria',
        destinationAccount: 'BMSC · Cta 4010-778210',
        status: 'aprobado',
        reviewedBy: adminEmail,
        reviewNote: 'Desembolso liquidado vía ACH',
      },
      {
        id: 'wdr_seed_2',
        partnerId: 'vn_root',
        partnerUid: adminUid,
        partnerName: adminName || 'Dirección Visión Next',
        amountBs: 650,
        method: 'qr_bolivia',
        destinationAccount: 'QR Banco Unión · 77012400',
        status: 'pendiente',
        reviewedBy: '',
        reviewNote: '',
      },
    ];

    for (const w of seedWithdrawals) {
      await setDoc(doc(db, 'withdrawals', w.id), {
        ...w,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await logAudit(
      'SYSTEM_SEED',
      'plan_config',
      'default',
      'Inicialización oficial del Plan de Prosperidad Vive Next 2026, catálogo de productos y red base.'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedInitialViveNextData');
  }
}

export async function registerPartnerNode(params: {
  id: string;
  ownerUid: string;
  fullName: string;
  sponsorId: string;
  binaryParentId: string;
  binaryLeg: BinaryLeg;
  packageTier: PackageTier;
  uplineUids: string[];
  email: string;
  phone: string;
  ciNumber: string;
  city: string;
  bankName: string;
  bankAccount: string;
}): Promise<Partner> {
  const code = `VN-${params.fullName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${Math.floor(100 + Math.random() * 899)}`;
  const partnerData = {
    id: params.id,
    ownerUid: params.ownerUid,
    fullName: params.fullName.trim(),
    referralCode: code,
    sponsorId: params.sponsorId,
    binaryParentId: params.binaryParentId,
    binaryLeg: params.binaryLeg,
    packageTier: params.packageTier,
    rankId: 'consultor_elite' as RankId,
    status: 'activo' as const,
    role: 'socio' as UserRole,
    personalPv: 0,
    personalCv: 0,
    leftBranchCv: 0,
    rightBranchCv: 0,
    teamCv: 0,
    directCount: 0,
    activeLines: 0,
    firstWeekPurchase: false,
    uplineUids: params.uplineUids.slice(0, 20),
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'partners', params.id), partnerData);
    await setDoc(doc(db, 'partners', params.id, 'private', 'info'), {
      partnerId: params.id,
      ownerUid: params.ownerUid,
      email: params.email,
      phone: params.phone || '+591',
      ciNumber: params.ciNumber || 'Pendiente',
      city: params.city || 'Santa Cruz',
      bankName: params.bankName || 'Por definir',
      bankAccount: params.bankAccount || 'Por definir',
      updatedAt: serverTimestamp(),
    });
    return { ...partnerData } as Partner;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `partners/${params.id}`);
  }
}

export async function updatePartnerPrivateInfo(
  partnerId: string,
  updates: Pick<PartnerPrivateInfo, 'phone' | 'ciNumber' | 'city' | 'bankName' | 'bankAccount'>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'partners', partnerId, 'private', 'info'), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `partners/${partnerId}/private/info`);
  }
}

export async function adminUpdatePartner(
  partnerId: string,
  updates: Partial<
    Pick<
      Partner,
      | 'role'
      | 'status'
      | 'packageTier'
      | 'rankId'
      | 'fullName'
      | 'personalPv'
      | 'personalCv'
      | 'leftBranchCv'
      | 'rightBranchCv'
      | 'teamCv'
      | 'sponsorId'
      | 'firstWeekPurchase'
    >
  >
): Promise<void> {
  try {
    await updateDoc(doc(db, 'partners', partnerId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      'PARTNER_UPDATED',
      'partners',
      partnerId,
      `Actualización administrativa de socio ${partnerId}: ${JSON.stringify(updates)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `partners/${partnerId}`);
  }
}

export async function adminDeletePartner(partnerId: string, partnerName: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'partners', partnerId));
    await logAudit(
      'PARTNER_DELETED',
      'partners',
      partnerId,
      `Socio eliminado por administración: ${partnerName} (${partnerId})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `partners/${partnerId}`);
  }
}

export async function adminDeleteOrder(orderId: string, orderNumber: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
    await logAudit('ORDER_DELETED', 'orders', orderId, `Pedido eliminado: ${orderNumber}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
  }
}

export async function adminCreateManualCommission(params: {
  partner: Partner;
  bonusType: BonusType;
  amountBs: number;
  baseCv: number;
  ratePercent: number;
  description: string;
}): Promise<void> {
  const id = makeId('com');
  const period = formatPeriodMonth();
  try {
    await setDoc(doc(db, 'commissions', id), {
      id,
      partnerId: params.partner.id,
      partnerUid: params.partner.ownerUid,
      partnerName: params.partner.fullName,
      sourceOrderId: 'admin_manual',
      bonusType: params.bonusType,
      level: 1,
      baseCv: params.baseCv,
      ratePercent: params.ratePercent,
      amountBs: params.amountBs,
      status: 'disponible',
      periodMonth: period,
      description: params.description.slice(0, 230),
      createdAt: serverTimestamp(),
    });
    await logAudit(
      'COMMISSION_MANUAL_CREATED',
      'commissions',
      id,
      `Comisión manual ${params.bonusType} de ${params.amountBs} Bs acreditada a ${params.partner.fullName}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `commissions/${id}`);
  }
}

export async function adminUpdateCommissionStatus(
  commissionId: string,
  status: CommissionStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commissions', commissionId), { status });
    await logAudit(
      'COMMISSION_STATUS_UPDATED',
      'commissions',
      commissionId,
      `Estado de comisión ${commissionId} cambiado a ${status}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commissions/${commissionId}`);
  }
}

export async function adminDeleteCommission(commissionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'commissions', commissionId));
    await logAudit('COMMISSION_DELETED', 'commissions', commissionId, `Comisión eliminada: ${commissionId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `commissions/${commissionId}`);
  }
}

export async function createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = makeId('ord');
  const orderNumber = `VN-2026-${Math.floor(1000 + Math.random() * 8999)}`;
  try {
    await setDoc(doc(db, 'orders', id), {
      ...order,
      id,
      orderNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${id}`);
  }
}

export async function validateOrderAndGenerateBonuses(
  order: Order,
  decision: 'validado' | 'rechazado',
  allPartners: Partner[],
  cvToBsRate = CV_TO_BS_DEFAULT
): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      paymentStatus: decision,
      validatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });

    if (decision === 'rechazado') {
      await logAudit('ORDER_REJECTED', 'orders', order.id, `Pedido ${order.orderNumber} rechazado.`);
      return;
    }

    const buyer = allPartners.find((p) => p.id === order.partnerId);
    if (buyer) {
      let nextTier: PackageTier = buyer.packageTier;
      const tierOrder: Record<PackageTier, number> = { base: 1, emprendedor: 2, elite: 3 };
      for (const item of order.items) {
        if (item.isPackage && item.packageTier !== 'none') {
          if (tierOrder[item.packageTier] > tierOrder[nextTier]) {
            nextTier = item.packageTier;
          }
        }
      }
      const newPv = buyer.personalPv + order.totalPv;
      const newCv = buyer.personalCv + order.totalCv;
      const newTeamCv = buyer.teamCv + order.totalCv;
      const nextRank = determineQualifiedRank(newPv, newTeamCv, buyer.rankId);
      const dayOfMonth = new Date().getDate();

      await updateDoc(doc(db, 'partners', buyer.id), {
        personalPv: newPv,
        personalCv: newCv,
        teamCv: newTeamCv,
        packageTier: nextTier,
        rankId: nextRank,
        status: newPv >= 75 ? 'activo' : buyer.status,
        firstWeekPurchase: buyer.firstWeekPurchase || dayOfMonth <= 7,
        updatedAt: serverTimestamp(),
      });

      // Propagate Binary leg CV & Team CV up the binary/sponsor chain
      let child = buyer;
      let depth = 0;
      while (child.binaryParentId && depth < 12) {
        const parent = allPartners.find((p) => p.id === child.binaryParentId);
        if (!parent) break;
        const leftAdd = child.binaryLeg === 'left' ? order.totalCv : 0;
        const rightAdd = child.binaryLeg === 'right' ? order.totalCv : 0;
        const updatedTeamCv = parent.teamCv + order.totalCv;
        await updateDoc(doc(db, 'partners', parent.id), {
          leftBranchCv: parent.leftBranchCv + leftAdd,
          rightBranchCv: parent.rightBranchCv + rightAdd,
          teamCv: updatedTeamCv,
          rankId: determineQualifiedRank(parent.personalPv, updatedTeamCv, parent.rankId),
          updatedAt: serverTimestamp(),
        });
        child = parent;
        depth++;
      }

      const period = formatPeriodMonth();

      // Bono 2: Inicio Rápido (25% / 3% / 2%) over 30% surcharge pool
      if (order.isFirstPurchase && order.surchargeBs > 0) {
        const rates = [
          { level: 1, pct: 25, shareOfPool: 25 / 30 },
          { level: 2, pct: 3, shareOfPool: 3 / 30 },
          { level: 3, pct: 2, shareOfPool: 2 / 30 },
        ];
        let currentSponsorId = buyer.sponsorId;
        for (const r of rates) {
          if (!currentSponsorId) break;
          const sponsor = allPartners.find((p) => p.id === currentSponsorId);
          if (!sponsor) break;
          if (sponsor.status === 'activo') {
            const amountBs = Math.round(order.surchargeBs * r.shareOfPool * 100) / 100;
            const cid = makeId('com');
            await setDoc(doc(db, 'commissions', cid), {
              id: cid,
              partnerId: sponsor.id,
              partnerUid: sponsor.ownerUid,
              partnerName: sponsor.fullName,
              sourceOrderId: order.id,
              bonusType: 'B2_INICIO_RAPIDO',
              level: r.level,
              baseCv: order.totalCv,
              ratePercent: r.pct,
              amountBs,
              status: 'disponible',
              periodMonth: period,
              description: `Bono Inicio Rápido N${r.level} (${r.pct}%) · Pedido ${order.orderNumber} de ${buyer.fullName}`,
              createdAt: serverTimestamp(),
            });
          }
          currentSponsorId = sponsor.sponsorId;
        }
      } else if (order.totalCv > 0) {
        // Bono 3: Unilevel Residual 20% Fijo (nivel 1 sponsor if Emprendedor or Élite)
        let currentSponsorId = buyer.sponsorId;
        let lvl = 1;
        while (currentSponsorId && lvl <= 5) {
          const sponsor = allPartners.find((p) => p.id === currentSponsorId);
          if (!sponsor) break;
          const pkgSpec = AFFILIATION_PACKAGES[sponsor.packageTier];
          if (sponsor.status === 'activo' && pkgSpec.allowsUnilevel) {
            const rankSpec = RANK_MAP[sponsor.rankId];
            const capturableCv = Math.min(order.totalCv, rankSpec.unilevelLineLimitCv);
            const amountBs = Math.round(capturableCv * 0.2 * cvToBsRate * 100) / 100;
            const cid = makeId('com');
            await setDoc(doc(db, 'commissions', cid), {
              id: cid,
              partnerId: sponsor.id,
              partnerUid: sponsor.ownerUid,
              partnerName: sponsor.fullName,
              sourceOrderId: order.id,
              bonusType: 'B3_UNILEVEL',
              level: lvl,
              baseCv: capturableCv,
              ratePercent: 20,
              amountBs,
              status: 'disponible',
              periodMonth: period,
              description: `Unilevel 20% Fijo N${lvl} · Recompra ${order.orderNumber} de ${buyer.fullName}`,
              createdAt: serverTimestamp(),
            });
            break;
          }
          currentSponsorId = sponsor.sponsorId;
          lvl++;
        }
      }
    }

    await logAudit(
      'ORDER_VALIDATED',
      'orders',
      order.id,
      `Pedido ${order.orderNumber} (${order.totalBs} Bs / ${order.totalPv} PV / ${order.totalCv} CV) validado con acreditación de bonos.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function runMonthlyCompensationCycle(
  partners: Partner[],
  config: PlanConfig
): Promise<{ generatedCount: number; totalBs: number }> {
  const period = formatPeriodMonth();
  let generatedCount = 0;
  let totalBs = 0;

  try {
    const eliteActives = partners.filter(
      (p) => p.status === 'activo' && p.packageTier === 'elite' && p.personalPv >= config.minMonthlyPv
    );

    const binaryTotalsByPartner: Record<string, number> = {};

    for (const p of eliteActives) {
      const minorCv = Math.min(p.leftBranchCv, p.rightBranchCv);
      const majorCv = Math.max(p.leftBranchCv, p.rightBranchCv);
      if (minorCv <= 0) continue;

      const eqRatio = majorCv > 0 ? (minorCv / majorCv) * 100 : 100;
      if (eqRatio < config.binaryEquilibriumPercent) continue;

      const rank = RANK_MAP[p.rankId];
      const rawBinBs = minorCv * (rank.binaryPercent / 100) * config.cvToBsRate;
      const binBs = Math.min(Math.round(rawBinBs * 100) / 100, rank.binaryMonthlyCapBs);

      if (binBs > 0) {
        const cid = makeId('com');
        await setDoc(doc(db, 'commissions', cid), {
          id: cid,
          partnerId: p.id,
          partnerUid: p.ownerUid,
          partnerName: p.fullName,
          sourceOrderId: `cycle_${period}`,
          bonusType: 'B4_BINARIO',
          level: 0,
          baseCv: minorCv,
          ratePercent: rank.binaryPercent,
          amountBs: binBs,
          status: 'disponible',
          periodMonth: period,
          description: `Cierre Binario Híbrido ${rank.name} (${rank.binaryPercent}%) sobre ${minorCv} CV rama menor`,
          createdAt: serverTimestamp(),
        });
        binaryTotalsByPartner[p.id] = binBs;
        generatedCount++;
        totalBs += binBs;

        if (p.firstWeekPurchase && p.personalPv >= rank.progressiveWeek1Pv) {
          const progBs = Math.round(minorCv * 0.05 * config.cvToBsRate * 100) / 100;
          const pid = makeId('com');
          await setDoc(doc(db, 'commissions', pid), {
            id: pid,
            partnerId: p.id,
            partnerUid: p.ownerUid,
            partnerName: p.fullName,
            sourceOrderId: `cycle_${period}`,
            bonusType: 'B5_BINARIO_PROGRESIVO',
            level: 0,
            baseCv: minorCv,
            ratePercent: 5,
            amountBs: progBs,
            status: 'disponible',
            periodMonth: period,
            description: `Binario Progresivo +5% Extra (1ª semana ${p.personalPv} PV)`,
            createdAt: serverTimestamp(),
          });
          generatedCount++;
          totalBs += progBs;
        }
      }
    }

    // Bono 6: Matching 50% Nivel 1 on directs' binary earnings
    for (const p of eliteActives) {
      const directsBinary = partners
        .filter((d) => d.sponsorId === p.id)
        .reduce((sum, d) => sum + (binaryTotalsByPartner[d.id] ?? 0), 0);
      if (directsBinary > 0) {
        const matchBs = Math.round(directsBinary * 0.5 * 100) / 100;
        const mid = makeId('com');
        await setDoc(doc(db, 'commissions', mid), {
          id: mid,
          partnerId: p.id,
          partnerUid: p.ownerUid,
          partnerName: p.fullName,
          sourceOrderId: `cycle_${period}`,
          bonusType: 'B6_MATCHING',
          level: 1,
          baseCv: Math.round(directsBinary / config.cvToBsRate),
          ratePercent: 50,
          amountBs: matchBs,
          status: 'disponible',
          periodMonth: period,
          description: `Matching Bonus 50% Nivel 1 sobre binario de directos (${period})`,
          createdAt: serverTimestamp(),
        });
        generatedCount++;
        totalBs += matchBs;
      }
    }

    await logAudit(
      'CYCLE_EXECUTED',
      'commissions',
      period,
      `Cierre de ciclo ${period}: ${generatedCount} comisiones generadas por un total de ${totalBs.toFixed(2)} Bs.`
    );
    return { generatedCount, totalBs: Math.round(totalBs * 100) / 100 };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'commissions/cycle');
  }
}

export async function requestWithdrawal(payload: {
  partnerId: string;
  partnerUid: string;
  partnerName: string;
  amountBs: number;
  method: Withdrawal['method'];
  destinationAccount: string;
}): Promise<void> {
  const id = makeId('wdr');
  try {
    await setDoc(doc(db, 'withdrawals', id), {
      ...payload,
      id,
      status: 'pendiente',
      reviewedBy: '',
      reviewNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${id}`);
  }
}

export async function reviewWithdrawal(
  withdrawal: Withdrawal,
  decision: 'aprobado' | 'rechazado',
  reviewNote: string
): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await updateDoc(doc(db, 'withdrawals', withdrawal.id), {
      status: decision,
      reviewedBy: adminEmail,
      reviewNote: reviewNote.slice(0, 230),
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      decision === 'aprobado' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
      'withdrawals',
      withdrawal.id,
      `Retiro de ${withdrawal.partnerName} por ${withdrawal.amountBs.toFixed(2)} Bs marcado como ${decision}.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
  }
}

export async function saveProduct(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  try {
    if (isNew) {
      await setDoc(doc(db, 'products', product.id), {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit('PRODUCT_CREATED', 'products', product.id, `Producto subido: ${product.name} (${product.wholesalePriceBs} Bs)`);
    } else {
      await updateDoc(doc(db, 'products', product.id), {
        sku: product.sku,
        name: product.name,
        category: product.category,
        isPackage: product.isPackage,
        packageTier: product.packageTier,
        retailPriceBs: product.retailPriceBs,
        wholesalePriceBs: product.wholesalePriceBs,
        firstPurchaseSurchargeBs: product.firstPurchaseSurchargeBs,
        pv: product.pv,
        cv: product.cv,
        stock: product.stock,
        active: product.active,
        imageUrl: product.imageUrl,
        description: product.description,
        updatedAt: serverTimestamp(),
      });
      await logAudit('PRODUCT_UPDATED', 'products', product.id, `Producto modificado: ${product.name}`);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `products/${product.id}`);
  }
}

export async function deleteProduct(productId: string, productName: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', productId));
    await logAudit('PRODUCT_DELETED', 'products', productId, `Producto eliminado del catálogo: ${productName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function compressProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 140000) {
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function updatePlanConfig(config: Omit<PlanConfig, 'updatedAt' | 'updatedBy'>): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await setDoc(doc(db, 'plan_config', config.id), {
      ...config,
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      'PLAN_CONFIG_UPDATED',
      'plan_config',
      config.id,
      `Parámetros del plan actualizados: 1 CV = ${config.cvToBsRate} Bs, Recompra ${config.minMonthlyPv} PV, Tope ${config.maxPayoutRatioPercent}%.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `plan_config/${config.id}`);
  }
}

export function subscribeProducts(isAdmin: boolean, cb: (items: Product[]) => void): Unsubscribe {
  const path = 'products';
  const q = isAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => d.data() as Product));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePartners(uid: string, isAdmin: boolean, cb: (items: Partner[]) => void): Unsubscribe {
  const path = 'partners';
  const q = isAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('uplineUids', 'array-contains', uid));
  return onSnapshot(
    q,
    async (snap) => {
      const list = snap.docs.map((d) => d.data() as Partner);
      if (!isAdmin) {
        try {
          const ownSnap = await getDocs(query(collection(db, path), where('ownerUid', '==', uid)));
          ownSnap.docs.forEach((d) => {
            const item = d.data() as Partner;
            if (!list.some((x) => x.id === item.id)) list.push(item);
          });
          const rootDoc = await getDoc(doc(db, path, 'vn_root'));
          if (rootDoc.exists() && !list.some((x) => x.id === 'vn_root')) {
            list.push(rootDoc.data() as Partner);
          }
        } catch {
          // Ignore optional root lookup if absent
        }
      }
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeOrders(uid: string, isAdmin: boolean, cb: (items: Order[]) => void): Unsubscribe {
  const path = 'orders';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('buyerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Order)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCommissions(uid: string, isAdmin: boolean, cb: (items: Commission[]) => void): Unsubscribe {
  const path = 'commissions';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('partnerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Commission)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeWithdrawals(uid: string, isAdmin: boolean, cb: (items: Withdrawal[]) => void): Unsubscribe {
  const path = 'withdrawals';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('partnerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Withdrawal)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePlanConfig(cb: (cfg: PlanConfig | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'plan_config', 'default'),
    (snap) => cb(snap.exists() ? (snap.data() as PlanConfig) : null),
    (err) => handleFirestoreError(err, OperationType.GET, 'plan_config/default')
  );
}

export function subscribeAuditLogs(cb: (items: AuditLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as AuditLog)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
  );
}

export async function fetchPartnerPrivateInfo(partnerId: string): Promise<PartnerPrivateInfo | null> {
  try {
    const snap = await getDoc(doc(db, 'partners', partnerId, 'private', 'info'));
    return snap.exists() ? (snap.data() as PartnerPrivateInfo) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `partners/${partnerId}/private/info`);
  }
}

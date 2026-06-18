import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BuyerInput,
  CustomerInput,
  DiscountStandardInput,
  DisposalReasonInput,
  ProductInput,
  ProductModelInput,
  SupplierInput,
} from '@tpg/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MasterdataService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Customers ----------
  listCustomers() {
    return this.prisma.customer.findMany({ orderBy: { code: 'asc' } });
  }
  createCustomer(input: CustomerInput) {
    return this.prisma.customer.create({ data: input });
  }
  updateCustomer(id: string, input: Partial<CustomerInput>) {
    return this.prisma.customer.update({ where: { id }, data: input });
  }

  // ---------- Suppliers ----------
  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { code: 'asc' } });
  }
  createSupplier(input: SupplierInput) {
    return this.prisma.supplier.create({ data: input });
  }
  updateSupplier(id: string, input: Partial<SupplierInput>) {
    return this.prisma.supplier.update({ where: { id }, data: input });
  }

  // ---------- Buyers ----------
  listBuyers() {
    return this.prisma.buyer.findMany({ orderBy: { name: 'asc' } });
  }
  createBuyer(input: BuyerInput) {
    return this.prisma.buyer.create({ data: input });
  }
  updateBuyer(id: string, input: Partial<BuyerInput>) {
    return this.prisma.buyer.update({ where: { id }, data: input });
  }

  // ---------- Products + models ----------
  listProducts() {
    return this.prisma.product.findMany({
      orderBy: { code: 'asc' },
      include: { models: { orderBy: { code: 'asc' } } },
    });
  }
  createProduct(input: ProductInput) {
    return this.prisma.product.create({ data: input });
  }
  updateProduct(id: string, input: Partial<ProductInput>) {
    return this.prisma.product.update({ where: { id }, data: input });
  }
  async createProductModel(input: ProductModelInput) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    return this.prisma.productModel.create({ data: input });
  }
  updateProductModel(id: string, input: Partial<Omit<ProductModelInput, 'productId'>>) {
    return this.prisma.productModel.update({ where: { id }, data: input });
  }

  // ---------- Discount standards ----------
  listDiscountStandards() {
    return this.prisma.discountStandard.findMany({
      orderBy: [{ productId: 'asc' }, { effectiveFrom: 'desc' }],
      include: { product: true, productModel: true },
    });
  }
  createDiscountStandard(input: DiscountStandardInput) {
    return this.prisma.discountStandard.create({
      data: {
        productId: input.productId,
        productModelId: input.productModelId ?? null,
        standardDiscount: input.standardDiscount,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }
  updateDiscountStandard(id: string, input: Partial<DiscountStandardInput>) {
    return this.prisma.discountStandard.update({
      where: { id },
      data: {
        ...(input.standardDiscount !== undefined
          ? { standardDiscount: input.standardDiscount }
          : {}),
        ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
        ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.productModelId !== undefined ? { productModelId: input.productModelId } : {}),
      },
    });
  }

  // ---------- Disposal reasons ----------
  listDisposalReasons() {
    return this.prisma.disposalReason.findMany({ orderBy: { code: 'asc' } });
  }
  createDisposalReason(input: DisposalReasonInput) {
    return this.prisma.disposalReason.create({ data: input });
  }
  updateDisposalReason(id: string, input: Partial<DisposalReasonInput>) {
    return this.prisma.disposalReason.update({ where: { id }, data: input });
  }
}

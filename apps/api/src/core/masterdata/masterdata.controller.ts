import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  buyerSchema,
  customerSchema,
  disposalReasonSchema,
  discountStandardSchema,
  Permissions,
  productModelSchema,
  productSchema,
  supplierSchema,
  type BuyerInput,
  type CustomerInput,
  type DiscountStandardInput,
  type DisposalReasonInput,
  type ProductInput,
  type ProductModelInput,
  type SupplierInput,
} from '@tpg/shared';
import { RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MasterdataService } from './masterdata.service';

const MANAGE = Permissions.CORE.MANAGE_MASTERDATA;
const MANAGE_STD = Permissions.CORE.MANAGE_DISCOUNT_STANDARDS;

@Controller('masterdata/customers')
export class CustomersController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listCustomers();
  }

  @Post()
  @RequirePermissions(MANAGE)
  create(@Body(new ZodValidationPipe(customerSchema)) body: CustomerInput) {
    return this.md.createCustomer(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(customerSchema.partial())) body: Partial<CustomerInput>,
  ) {
    return this.md.updateCustomer(id, body);
  }
}

@Controller('masterdata/suppliers')
export class SuppliersController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listSuppliers();
  }

  @Post()
  @RequirePermissions(MANAGE)
  create(@Body(new ZodValidationPipe(supplierSchema)) body: SupplierInput) {
    return this.md.createSupplier(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(supplierSchema.partial())) body: Partial<SupplierInput>,
  ) {
    return this.md.updateSupplier(id, body);
  }
}

@Controller('masterdata/buyers')
export class BuyersController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listBuyers();
  }

  @Post()
  @RequirePermissions(MANAGE)
  create(@Body(new ZodValidationPipe(buyerSchema)) body: BuyerInput) {
    return this.md.createBuyer(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(buyerSchema.partial())) body: Partial<BuyerInput>,
  ) {
    return this.md.updateBuyer(id, body);
  }
}

@Controller('masterdata/products')
export class ProductsController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listProducts();
  }

  @Post()
  @RequirePermissions(MANAGE)
  create(@Body(new ZodValidationPipe(productSchema)) body: ProductInput) {
    return this.md.createProduct(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(productSchema.partial())) body: Partial<ProductInput>,
  ) {
    return this.md.updateProduct(id, body);
  }

  @Post('models')
  @RequirePermissions(MANAGE)
  createModel(@Body(new ZodValidationPipe(productModelSchema)) body: ProductModelInput) {
    return this.md.createProductModel(body);
  }

  @Patch('models/:id')
  @RequirePermissions(MANAGE)
  updateModel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(productModelSchema.omit({ productId: true }).partial()))
    body: Partial<Omit<ProductModelInput, 'productId'>>,
  ) {
    return this.md.updateProductModel(id, body);
  }
}

@Controller('masterdata/discount-standards')
export class DiscountStandardsController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listDiscountStandards();
  }

  @Post()
  @RequirePermissions(MANAGE_STD)
  create(@Body(new ZodValidationPipe(discountStandardSchema)) body: DiscountStandardInput) {
    return this.md.createDiscountStandard(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE_STD)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(discountStandardSchema.partial()))
    body: Partial<DiscountStandardInput>,
  ) {
    return this.md.updateDiscountStandard(id, body);
  }
}

@Controller('masterdata/disposal-reasons')
export class DisposalReasonsController {
  constructor(private readonly md: MasterdataService) {}

  @Get()
  list() {
    return this.md.listDisposalReasons();
  }

  @Post()
  @RequirePermissions(MANAGE)
  create(@Body(new ZodValidationPipe(disposalReasonSchema)) body: DisposalReasonInput) {
    return this.md.createDisposalReason(body);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(disposalReasonSchema.partial()))
    body: Partial<DisposalReasonInput>,
  ) {
    return this.md.updateDisposalReason(id, body);
  }
}

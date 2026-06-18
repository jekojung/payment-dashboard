import { Module } from '@nestjs/common';
import {
  BuyersController,
  CustomersController,
  DiscountStandardsController,
  DisposalReasonsController,
  ProductsController,
  SuppliersController,
} from './masterdata.controller';
import { MasterdataService } from './masterdata.service';

@Module({
  controllers: [
    CustomersController,
    SuppliersController,
    BuyersController,
    ProductsController,
    DiscountStandardsController,
    DisposalReasonsController,
  ],
  providers: [MasterdataService],
  exports: [MasterdataService],
})
export class MasterdataModule {}

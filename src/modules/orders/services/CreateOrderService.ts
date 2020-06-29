import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists');
    }

    const productsIds = products.map(product => {
      return { id: product.id };
    });

    const findedProducts = await this.productsRepository.findAllById(
      productsIds,
    );

    if (findedProducts.length === 0) {
      throw new AppError('No one of informed products exists');
    }

    const productsFormatted = findedProducts.map(product => {
      const informedQuantity =
        products.find(prod => prod.id === product.id)?.quantity || 0;

      if (product.quantity < informedQuantity) {
        throw new AppError(
          "One of informed product of this order don't have enought items",
        );
      }

      return {
        product_id: product.id,
        price: product.price,
        quantity: informedQuantity,
        originalQuantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsFormatted,
    });

    const productsFormattedToUpdate = productsFormatted.map(product => {
      return {
        id: product.product_id,
        quantity: product.originalQuantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsFormattedToUpdate);

    return order;
  }
}

export default CreateOrderService;

import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { TrackerService } from './tracker.service';

@Controller('tracker')
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Get()
  async getGasPrices() {
    try {
      const gasPrices = await this.trackerService.getGasPrice();

      // Optional: Transform the response to a more specific format if needed
      return {
        status: 'success',
        data: {
          bnb: {
            price: gasPrices.bnbPrice.result.ethusd,
            gas: gasPrices.bnbGas.result.SafeGasPrice,
          },
          eth: {
            price: gasPrices.ethPrice.result.ethusd,
            gas: gasPrices.ethGas.result.SafeGasPrice,
          },
          base: {
            price: gasPrices.ethPrice.result.ethusd,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to fetch gas prices',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

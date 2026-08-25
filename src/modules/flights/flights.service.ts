import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FlightsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const flights = await this.prisma.flight.findMany({ orderBy: { departureTime: 'asc' } });
    return { success: true, data: flights };
  }

  async create(data: any) {
    const flight = await this.prisma.flight.create({
      data: {
        flightNumber: data.flightNumber,
        airline: data.airline,
        departureAirport: data.departureAirport,
        arrivalAirport: data.arrivalAirport,
        departureTime: new Date(data.departureTime),
        arrivalTime: new Date(data.arrivalTime),
        status: data.status || 'SCHEDULED',
      },
    });
    return { success: true, message: 'Flight created successfully', data: flight };
  }
}

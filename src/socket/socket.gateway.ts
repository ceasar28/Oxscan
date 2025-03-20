import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TransactionDto } from './dto/transaction.dto';
import { UsePipes, ValidationPipe } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('newTransaction')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  handleNewTransaction(@MessageBody() transactionDto: TransactionDto) {
    console.log('New transaction received:', transactionDto);
    this.server.emit('onNewTransaction', {
      msg: 'New Transaction',
      content: transactionDto,
    });
  }
}

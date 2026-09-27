import { Body, ConflictException, Controller, Get, Injectable, Module, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { User } from '../database/entities';

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() university?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) semester?: number;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService) {}

  private token(u: User) {
    const payload: JwtUser = { sub: u.id, email: u.email, role: u.role, name: u.name };
    const { passwordHash: _, ...user } = u;
    return { accessToken: this.jwt.sign(payload), user };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.exists({ where: { email } })) throw new ConflictException('E-mail já cadastrado');
    const user = await this.users.save(this.users.create({
      ...dto, email, passwordHash: await bcrypt.hash(dto.password, 10),
    }));
    return this.token(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: { email: dto.email.toLowerCase() },
      select: ['id', 'name', 'email', 'role', 'university', 'semester', 'xp', 'createdAt', 'passwordHash'],
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.token(user);
  }
}

@Controller('auth')
class AuthController {
  constructor(private auth: AuthService, @InjectRepository(User) private users: Repository<User>) {}

  @Public() @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Get('me') me(@CurrentUser() u: JwtUser) { return this.users.findOneByOrFail({ id: u.sub }); }
}

@Module({ imports: [TypeOrmModule.forFeature([User])], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}

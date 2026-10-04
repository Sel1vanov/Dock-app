import { UserRepository } from '../repositories/UserRepository';

export class UserService {
  private userRepo = new UserRepository();

  async getUsersCount(): Promise<number> {
    const users = await this.userRepo.getAllUsers();
    return users.length;
  }
}
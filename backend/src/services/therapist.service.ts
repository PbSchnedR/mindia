import bcrypt from 'bcryptjs';
import { Therapist, type ITherapist } from '../models/index.js';

export interface CreateTherapistInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city?: string;
  profession?: string;
  bookingUrl?: string;
}

export interface UpdateTherapistInput {
  firstName?: string;
  lastName?: string;
  city?: string;
  profession?: string;
  bookingUrl?: string;
}

export class TherapistService {
  /**
   * Créer un nouveau thérapeute
   */
  async create(input: CreateTherapistInput): Promise<ITherapist> {
    const hashedPassword = await bcrypt.hash(input.password, 12);
    
    const therapist = new Therapist({
      ...input,
      password: hashedPassword,
    });
    
    return therapist.save();
  }

  /**
   * Trouver un thérapeute par ID
   */
  async findById(id: string): Promise<ITherapist | null> {
    return Therapist.findById(id);
  }

  /**
   * Trouver un thérapeute par email
   */
  async findByEmail(email: string): Promise<ITherapist | null> {
    return Therapist.findOne({ email: email.toLowerCase() });
  }

  /**
   * Trouver un thérapeute par email avec mot de passe (pour auth)
   */
  async findByEmailWithPassword(email: string): Promise<ITherapist | null> {
    return Therapist.findOne({ email: email.toLowerCase() }).select('+password');
  }

  /**
   * Mettre à jour un thérapeute
   */
  async update(id: string, input: UpdateTherapistInput): Promise<ITherapist | null> {
    return Therapist.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  }

  /**
   * Vérifier le mot de passe d'un thérapeute
   */
  async verifyPassword(therapist: ITherapist, password: string): Promise<boolean> {
    return bcrypt.compare(password, therapist.password);
  }

  /**
   * Lister tous les thérapeutes (admin)
   */
  async findAll(): Promise<ITherapist[]> {
    return Therapist.find().sort({ lastName: 1, firstName: 1 });
  }
}

export const therapistService = new TherapistService();

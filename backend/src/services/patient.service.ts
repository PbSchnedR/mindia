import crypto from 'crypto';
import { Patient, type IPatient } from '../models/index.js';

export interface CreatePatientInput {
  therapistId: string;
  firstName: string;
  lastName: string;
  email: string;
  birthYear?: number;
  profession?: string;
  familySituation?: string;
  therapyTopic?: string;
  bookingUrl?: string;
}

export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthYear?: number;
  profession?: string;
  familySituation?: string;
  therapyTopic?: string;
  sessionsDone?: number;
  lastSessionAt?: Date;
  nextSessionAt?: Date;
  bookingUrl?: string;
  score?: number;
}

export class PatientService {
  /**
   * Générer un magic token unique
   */
  private generateMagicToken(): string {
    const prefix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const year = new Date().getFullYear();
    return `${prefix}-${year}`;
  }

  /**
   * Créer un nouveau patient
   */
  async create(input: CreatePatientInput): Promise<IPatient> {
    const patient = new Patient({
      ...input,
      magicToken: this.generateMagicToken(),
      sessionsDone: 0,
    });

    return patient.save();
  }

  /**
   * Trouver un patient par ID
   */
  async findById(id: string): Promise<IPatient | null> {
    return Patient.findById(id);
  }

  /**
   * Trouver un patient par magic token
   */
  async findByMagicToken(token: string): Promise<IPatient | null> {
    return Patient.findOne({ magicToken: token.toUpperCase() });
  }

  /**
   * Lister les patients d'un thérapeute
   */
  async findByTherapist(therapistId: string): Promise<IPatient[]> {
    return Patient.find({ therapistId })
      .sort({ lastName: 1, firstName: 1 });
  }

  /**
   * Mettre à jour un patient
   */
  async update(id: string, input: UpdatePatientInput): Promise<IPatient | null> {
    return Patient.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  }

  /**
   * Incrémenter le nombre de séances
   */
  async incrementSessions(id: string): Promise<IPatient | null> {
    return Patient.findByIdAndUpdate(
      id,
      {
        $inc: { sessionsDone: 1 },
        lastSessionAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Régénérer le magic token d'un patient
   */
  async regenerateMagicToken(id: string): Promise<IPatient | null> {
    return Patient.findByIdAndUpdate(
      id,
      { magicToken: this.generateMagicToken() },
      { new: true }
    );
  }

  /**
   * Supprimer un patient
   */
  async delete(id: string): Promise<boolean> {
    const result = await Patient.findByIdAndDelete(id);
    return result !== null;
  }
}

export const patientService = new PatientService();

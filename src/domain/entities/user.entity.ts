/**
 * User Aggregate Root
 * Core domain entity representing a user
 */

import { UserId } from "../value-objects/user-id.vo";
import { Email } from "../value-objects/email.vo";
import { Phone } from "../value-objects/phone.vo";
import { AuthProvider, Timestamp } from "../../shared/types";

export interface UserProps {
  id: UserId;
  email: Email;
  phone?: Phone;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  authProviders: AuthProvider[];
  totpSecret?: string;
  passKeyCredential?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class User {
  private constructor(private props: UserProps) {}

  static create(props: Omit<UserProps, "id" | "createdAt" | "updatedAt">): User {
    const now = new Date();
    return new User({
      ...props,
      id: UserId.create(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  // Getters
  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get phone(): Phone | undefined {
    return this.props.phone;
  }

  get firstName(): string | undefined {
    return this.props.firstName;
  }

  get lastName(): string | undefined {
    return this.props.lastName;
  }

  get fullName(): string {
    return [this.props.firstName, this.props.lastName].filter(Boolean).join(" ");
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }

  get isPhoneVerified(): boolean {
    return this.props.isPhoneVerified;
  }

  get authProviders(): AuthProvider[] {
    return [...this.props.authProviders];
  }

  get totpSecret(): string | undefined {
    return this.props.totpSecret;
  }

  get passKeyCredential(): string | undefined {
    return this.props.passKeyCredential;
  }

  get createdAt(): Timestamp {
    return this.props.createdAt;
  }

  get updatedAt(): Timestamp {
    return this.props.updatedAt;
  }

  // Domain methods
  updateProfile(data: { firstName?: string; lastName?: string }): void {
    if (data.firstName !== undefined) {
      this.props.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      this.props.lastName = data.lastName;
    }
    this.props.updatedAt = new Date();
  }

  updateAvatarUrl(url: string): void {
    this.props.avatarUrl = url;
    this.props.updatedAt = new Date();
  }

  updatePhone(phone: Phone): void {
    this.props.phone = phone;
    this.props.isPhoneVerified = false;
    this.props.updatedAt = new Date();
  }

  verifyEmail(): void {
    this.props.isEmailVerified = true;
    this.props.updatedAt = new Date();
  }

  verifyPhone(): void {
    this.props.isPhoneVerified = true;
    this.props.updatedAt = new Date();
  }

  addAuthProvider(provider: AuthProvider): void {
    if (!this.props.authProviders.includes(provider)) {
      this.props.authProviders.push(provider);
      this.props.updatedAt = new Date();
    }
  }

  setTotpSecret(secret: string): void {
    this.props.totpSecret = secret;
    this.addAuthProvider(AuthProvider.TOTP);
  }

  setPassKeyCredential(credential: string): void {
    this.props.passKeyCredential = credential;
    this.addAuthProvider(AuthProvider.PASSKEY);
  }

  hasAuthProvider(provider: AuthProvider): boolean {
    return this.props.authProviders.includes(provider);
  }

  toJSON() {
    return {
      id: this.props.id.getValue(),
      email: this.props.email.getValue(),
      phone: this.props.phone?.getValue(),
      firstName: this.props.firstName,
      lastName: this.props.lastName,
      fullName: this.fullName,
      avatarUrl: this.props.avatarUrl,
      isEmailVerified: this.props.isEmailVerified,
      isPhoneVerified: this.props.isPhoneVerified,
      authProviders: this.props.authProviders,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { completeOnboardingAction } from '@/lib/actions/onboarding';

interface OnboardingFormProps {
  defaultName?: string;
  redirectTo?: string;
}

export function OnboardingForm({
  defaultName,
  redirectTo,
}: OnboardingFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState(defaultName ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await completeOnboardingAction({ email, firstName });
      if (result.success) {
        toast({ title: '✓ Profil complété', description: 'Bienvenue !' });
        router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="firstName">Prénom</Label>
        <Input
          id="firstName"
          className="mt-2"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          className="mt-2"
          placeholder="tu@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <p className="text-xs text-[var(--color-text-faint)] mt-2">
          On l'utilise uniquement pour la facturation et les confirmations.
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Continuer
      </Button>
    </form>
  );
}

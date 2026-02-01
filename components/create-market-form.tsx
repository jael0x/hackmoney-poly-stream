'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const formSchema = z.object({
  streamerId: z.string().min(1, 'Please select a streamer'),
  question: z.string().min(10, 'Question must be at least 10 characters'),
  description: z.string().optional(),
  endDate: z.date({
    required_error: 'Please select a resolution date',
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateMarketFormProps {
  streamers: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export function CreateMarketForm({ streamers }: CreateMarketFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      streamerId: '',
      question: '',
      description: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.from('markets').insert({
        streamer_id: values.streamerId,
        question: values.question,
        description: values.description || null,
        end_date: values.endDate.toISOString(),
        status: 'active' as const,
      } as any);

      if (error) {
        console.error('Error creating market:', error);
        alert('Failed to create market. Please try again.');
        return;
      }

      const streamer = streamers.find((s) => s.id === values.streamerId);
      if (streamer) {
        router.push(`/streamer/${streamer.slug}`);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="streamerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Streamer</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                    <SelectValue placeholder="Select a streamer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-gray-900 border-gray-800">
                  {streamers.map((streamer) => (
                    <SelectItem
                      key={streamer.id}
                      value={streamer.id}
                      className="text-white focus:bg-gray-800 focus:text-white"
                    >
                      {streamer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-gray-500">
                Choose the streamer this market is about
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Question</FormLabel>
              <FormControl>
                <Input
                  placeholder="Will the streamer achieve X by end of stream?"
                  className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-gray-500">
                The prediction question that people will bet on
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional details about this market..."
                  className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-gray-500">
                Add more context or rules for this prediction
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-white">Resolution Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal bg-gray-900 border-gray-800 text-white hover:bg-gray-800 hover:text-white',
                        !field.value && 'text-gray-600'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="bg-gray-900 text-white"
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className="text-gray-500">
                When this market will be resolved
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 bg-gray-900 border-gray-800 text-white hover:bg-gray-800"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Market'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

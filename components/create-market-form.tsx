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
  twitchMetric: z.enum(['viewer_count', 'followers_count'], {
    required_error: 'Please select a Twitch metric',
  }),
  targetValue: z.coerce.number().min(1, 'Target value must be at least 1'),
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
      twitchMetric: 'viewer_count',
      targetValue: 10000,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Call API to create market with Yellow Network integration
      const response = await fetch('/api/markets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamerId: values.streamerId,
          question: values.question,
          description: values.description || null,
          twitchMetric: values.twitchMetric,
          targetValue: values.targetValue,
          endDate: values.endDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('Error creating market:', data.error);
        alert(data.error || 'Failed to create market. Please try again.');
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
          name="twitchMetric"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Twitch Metric</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                    <SelectValue placeholder="Select a metric to track" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem
                    value="viewer_count"
                    className="text-white focus:bg-gray-800 focus:text-white"
                  >
                    Viewer Count (live viewers)
                  </SelectItem>
                  <SelectItem
                    value="followers_count"
                    className="text-white focus:bg-gray-800 focus:text-white"
                  >
                    Follower Count (total followers)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-gray-500">
                Which Twitch metric will determine the outcome
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Target Value</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="10000"
                  className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-gray-500">
                YES wins if metric reaches this value, NO wins otherwise
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
